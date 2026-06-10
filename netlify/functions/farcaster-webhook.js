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

async function forwardToAgent(eventPayload) {
  const { FARCASTER_EVENT_FORWARD_URL, FARCASTER_EVENT_FORWARD_SECRET } = process.env;

  if (!FARCASTER_EVENT_FORWARD_URL) {
    return;
  }

  const response = await fetch(FARCASTER_EVENT_FORWARD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(FARCASTER_EVENT_FORWARD_SECRET
        ? { Authorization: `Bearer ${FARCASTER_EVENT_FORWARD_SECRET}` }
        : {}),
    },
    body: JSON.stringify({
      source: "xpenny-farcaster-miniapp",
      received_at: new Date().toISOString(),
      event: eventPayload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Forward target returned HTTP ${response.status}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return json(200, {
      ok: true,
      service: "xpenny farcaster miniapp webhook",
      expected_method: "POST",
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  const payload = parseBody(event.body);

  if (!payload) {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  console.log("Farcaster miniapp event:", JSON.stringify({
    event: payload.event,
    type: payload.type,
    fid: payload.fid || payload?.notificationDetails?.fid,
  }));

  try {
    await forwardToAgent(payload);
  } catch (error) {
    console.error("Farcaster event forward failed:", error);
    return json(502, { ok: false, error: "Forward failed" });
  }

  return json(200, { ok: true });
};

