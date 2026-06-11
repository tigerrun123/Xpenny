const crypto = require("crypto");

const SITE_URL = (process.env.URL || "https://xpenny.netlify.app").replace(/\/$/, "");
const BOT_USERNAME = (process.env.NEYNAR_BOT_USERNAME || "xtoken123").replace(/^@/, "");
const NEYNAR_API_BASE = "https://api.neynar.com/v2/farcaster";
const BACKGROUND_FUNCTION_URL = `${SITE_URL}/.netlify/functions/neynar-openclaw-background`;

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

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function extractCast(payload) {
  const data = payload?.data || {};
  const cast = data.cast || payload?.cast || data;
  const author = cast.author || data.author || payload.author || {};

  return {
    text: String(pick(cast.text, data.text, payload.text, "") || ""),
    hash: pick(cast.hash, data.hash, payload.hash, payload.cast_hash),
    authorFid: pick(author.fid, cast.author_fid, data.author_fid, payload.author_fid),
    authorUsername: pick(author.username, cast.author_username, data.author_username),
  };
}

function stripBotMention(text) {
  const mention = new RegExp(`(^|\\s)@${BOT_USERNAME}\\b`, "i");
  return text.replace(mention, " ").replace(/\s+/g, " ").trim();
}

function miniAppUrl(prompt) {
  const url = new URL(SITE_URL);
  url.searchParams.set("q", prompt);
  return url.toString();
}

function verifyNeynarSignature(event) {
  const secret = process.env.NEYNAR_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  const signature =
    event.headers["x-neynar-signature"] ||
    event.headers["X-Neynar-Signature"] ||
    event.headers["x-neynar-webhook-signature"];

  if (!signature) {
    return false;
  }

  const digest = crypto.createHmac("sha512", secret).update(event.body || "").digest("hex");
  const received = String(signature).replace(/^sha512=/, "");

  if (digest.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(received));
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

function buildBackgroundHeaders() {
  const { OPENCLAW_AGENT_TOKEN } = process.env;

  return OPENCLAW_AGENT_TOKEN ? { Authorization: `Bearer ${OPENCLAW_AGENT_TOKEN}` } : {};
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
        source: "xpenny-neynar-mention",
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

function compactReply(reply, url) {
  const intro = reply
    ? reply.replace(/\s+/g, " ").trim().slice(0, 180)
    : "Open this in Xpenny and I will route it to the AWS OpenClaw agent.";

  return `${intro}\n\nOpen Xpenny:\n${url}`;
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

async function enqueueOpenClawReply({ prompt, miniAppUrl, cast }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(BACKGROUND_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildBackgroundHeaders(),
      },
      body: JSON.stringify({
        prompt,
        miniAppUrl,
        cast,
      }),
      signal: controller.signal,
    });

    if (!response.ok && response.status !== 202) {
      throw new Error(`Background function returned HTTP ${response.status}`);
    }

    return true;
  } finally {
    clearTimeout(timeout);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return json(200, {
      ok: true,
      service: "xpenny neynar mention webhook",
      bot: `@${BOT_USERNAME}`,
      configured: {
        openclaw: Boolean(process.env.OPENCLAW_AGENT_URL),
        neynar: Boolean(process.env.NEYNAR_API_KEY && process.env.NEYNAR_SIGNER_UUID),
        background: Boolean(process.env.OPENCLAW_AGENT_TOKEN),
        signature: Boolean(process.env.NEYNAR_WEBHOOK_SECRET),
      },
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  if (!verifyNeynarSignature(event)) {
    return json(401, { ok: false, error: "Invalid Neynar webhook signature" });
  }

  const payload = parseBody(event.body);

  if (!payload) {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const cast = extractCast(payload);
  const prompt = stripBotMention(cast.text);

  if (!cast.hash || !cast.authorFid || !prompt) {
    return json(200, {
      ok: true,
      ignored: true,
      reason: "No cast hash, author fid, or prompt text found",
    });
  }

  const url = miniAppUrl(prompt);
  let openClawReply = "";

  if (process.env.NEYNAR_MENTION_SYNC_OPENCLAW !== "true") {
    try {
      await enqueueOpenClawReply({ prompt, miniAppUrl: url, cast });

      return json(202, {
        ok: true,
        queued: true,
        mode: "direct-background-reply",
        prompt,
        miniAppUrl: url,
      });
    } catch (error) {
      console.error("OpenClaw background enqueue failed:", error);
      openClawReply = "I received this, but the background OpenClaw worker did not start. Open Xpenny to run it there.";
    }
  }

  if (process.env.NEYNAR_MENTION_SYNC_OPENCLAW === "true") {
    try {
      openClawReply = await askOpenClaw(prompt, cast);
    } catch (error) {
      console.error("OpenClaw mention lookup failed:", error);
      openClawReply = "OpenClaw is slow on this request, but the Mini App link is ready.";
    }
  }

  const replyText = compactReply(openClawReply, url);

  try {
    const publish = await publishReply({
      text: replyText,
      parent: cast.hash,
      parentAuthorFid: cast.authorFid,
    });

    return json(200, {
      ok: true,
      prompt,
      miniAppUrl: url,
      replyText,
      ...publish,
    });
  } catch (error) {
    console.error("Neynar reply failed:", error);
    return json(502, {
      ok: false,
      prompt,
      miniAppUrl: url,
      replyText,
      error: error.message,
    });
  }
};
