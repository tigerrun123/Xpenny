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

function extractReply(payload) {
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

function buildHeaders() {
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

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return json(200, {
      ok: true,
      service: "xpenny openclaw chat bridge",
      configured: Boolean(process.env.OPENCLAW_AGENT_URL),
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const body = parseBody(event.body);

  if (!body) {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const message = String(body.message || "").trim();

  if (!message) {
    return json(400, { ok: false, error: "Message is required" });
  }

  const { OPENCLAW_AGENT_URL, OPENCLAW_AGENT_TIMEOUT_MS = "60000" } = process.env;

  if (!OPENCLAW_AGENT_URL) {
    return json(200, {
      ok: true,
      configured: false,
      reply: [
        "Netlify bridge is working.",
        "",
        "Next step: set OPENCLAW_AGENT_URL in Netlify to the AWS OpenClaw bridge endpoint.",
        "Keep any OpenClaw token in Netlify environment variables, never in the Mini App frontend.",
      ].join("\n"),
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(OPENCLAW_AGENT_TIMEOUT_MS));

  try {
    const response = await fetch(OPENCLAW_AGENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildHeaders(),
      },
      body: JSON.stringify({
        message,
        source: body.source || "xpenny-farcaster-miniapp",
        user: body.user || null,
      }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return json(response.status, {
        ok: false,
        configured: true,
        error: `AWS OpenClaw endpoint returned HTTP ${response.status}`,
      });
    }

    return json(200, {
      ok: true,
      configured: true,
      reply: extractReply(payload) || "AWS OpenClaw returned no reply text.",
      raw: extractReply(payload) ? undefined : payload,
    });
  } catch (error) {
    return json(502, {
      ok: false,
      configured: true,
      error:
        error.name === "AbortError"
          ? "AWS OpenClaw is still thinking. Try again with a narrower question, or wait a moment and resend."
          : error.message,
    });
  } finally {
    clearTimeout(timeout);
  }
};
