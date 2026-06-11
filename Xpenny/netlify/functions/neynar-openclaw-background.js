const SITE_URL = (process.env.URL || "https://xpenny.netlify.app").replace(/\/$/, "");
const NEYNAR_API_BASE = "https://api.neynar.com/v2/farcaster";

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function parseBody(body) {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function verifyBackgroundRequest(event) {
  const token = process.env.OPENCLAW_AGENT_TOKEN;

  if (!token) {
    return false;
  }

  return event.headers.authorization === `Bearer ${token}`;
}

function buildOpenClawHeaders() {
  const {
    OPENCLAW_AGENT_TOKEN,
    OPENCLAW_AGENT_AUTH_HEADER = "Authorization",
    OPENCLAW_AGENT_AUTH_SCHEME = "Bearer",
  } = process.env;

  if (!OPENCLAW_AGENT_TOKEN) {
    return {};
  }

  const value = OPENCLAW_AGENT_AUTH_SCHEME
    ? `${OPENCLAW_AGENT_AUTH_SCHEME} ${OPENCLAW_AGENT_TOKEN}`
    : OPENCLAW_AGENT_TOKEN;

  return { [OPENCLAW_AGENT_AUTH_HEADER]: value };
}

function extractOpenClawReply(payload) {
  if (typeof payload === "string") {
    return payload;
  }

  return (
    payload?.reply ||
    payload?.message ||
    payload?.output_text ||
    payload?.output ||
    payload?.text ||
    payload?.choices?.[0]?.message?.content ||
    payload?.data?.reply ||
    payload?.data?.message ||
    ""
  );
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function directReplyText(reply, miniAppUrl) {
  const fallback = "OpenClaw is slow on this request. Open Xpenny to continue the run.";
  const answer = normalizeText(reply || fallback);
  const maxAnswerLength = Math.max(80, 290 - miniAppUrl.length);
  const clipped = answer.length > maxAnswerLength
    ? `${answer.slice(0, maxAnswerLength - 1)}...`
    : answer;

  return `${clipped}\n\nOpen Xpenny:\n${miniAppUrl}`;
}

async function askOpenClaw(message, cast) {
  const { OPENCLAW_AGENT_URL, OPENCLAW_AGENT_TIMEOUT_MS = "60000" } = process.env;

  if (!OPENCLAW_AGENT_URL) {
    return "";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(OPENCLAW_AGENT_TIMEOUT_MS));

  try {
    const response = await fetch(OPENCLAW_AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildOpenClawHeaders(),
      },
      body: JSON.stringify({
        message,
        source: "xpenny-neynar-background-mention",
        user: {
          fid: cast.authorFid,
          username: cast.authorUsername,
        },
      }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(`OpenClaw returned HTTP ${response.status}`);
    }

    return extractOpenClawReply(payload);
  } finally {
    clearTimeout(timeout);
  }
}

async function publishReply({ text, parent, parentAuthorFid }) {
  const { NEYNAR_API_KEY, NEYNAR_SIGNER_UUID } = process.env;

  if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
    return { posted: false, reason: "NEYNAR_API_KEY or NEYNAR_SIGNER_UUID is not configured" };
  }

  const response = await fetch(`${NEYNAR_API_BASE}/cast/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": NEYNAR_API_KEY,
    },
    body: JSON.stringify({
      signer_uuid: NEYNAR_SIGNER_UUID,
      text,
      parent,
      parent_author_fid: Number(parentAuthorFid),
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || `Neynar returned HTTP ${response.status}`);
  }

  return { posted: true, payload };
}

async function hasExistingReply(parentHash) {
  const { NEYNAR_API_KEY, NEYNAR_BOT_FID = "3313201" } = process.env;

  if (!NEYNAR_API_KEY || !parentHash) {
    return false;
  }

  const response = await fetch(
    `${NEYNAR_API_BASE}/feed/user/casts?fid=${encodeURIComponent(NEYNAR_BOT_FID)}&limit=25`,
    { headers: { "x-api-key": NEYNAR_API_KEY } },
  );

  if (!response.ok) {
    return false;
  }

  const payload = await response.json().catch(() => ({}));
  return Boolean(payload?.casts?.some((cast) => cast.parent_hash === parentHash));
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return json(200, {
      ok: true,
      service: "xpenny neynar openclaw background reply",
      configured: {
        openclaw: Boolean(process.env.OPENCLAW_AGENT_URL),
        neynar: Boolean(process.env.NEYNAR_API_KEY && process.env.NEYNAR_SIGNER_UUID),
        auth: Boolean(process.env.OPENCLAW_AGENT_TOKEN),
      },
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  if (!verifyBackgroundRequest(event)) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  const body = parseBody(event.body);

  if (!body) {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const prompt = normalizeText(body.prompt);
  const miniAppUrl = body.miniAppUrl || `${SITE_URL}?q=${encodeURIComponent(prompt)}`;
  const cast = body.cast || {};

  if (!prompt || !cast.hash || !cast.authorFid) {
    return json(400, { ok: false, error: "Prompt, cast hash, and author fid are required" });
  }

  if (await hasExistingReply(cast.hash)) {
    return json(200, { ok: true, skipped: true, reason: "Reply already exists" });
  }

  let reply = "";

  try {
    reply = await askOpenClaw(prompt, cast);
  } catch (error) {
    console.error("Background OpenClaw request failed:", error);
    reply = "";
  }

  const publish = await publishReply({
    text: directReplyText(reply, miniAppUrl),
    parent: cast.hash,
    parentAuthorFid: cast.authorFid,
  });

  return json(200, {
    ok: true,
    prompt,
    parent: cast.hash,
    ...publish,
  });
};
