const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 8080);
const publicDir = path.join(__dirname, "public");
const openClawVisionWebhookUrl = process.env.OPENCLAW_VISION_WEBHOOK_URL || "";
const openClawVisionWebhookToken = process.env.OPENCLAW_VISION_WEBHOOK_TOKEN || "";
const openClawAgentUrl = process.env.OPENCLAW_AGENT_URL || "";
const openClawAgentToken = process.env.OPENCLAW_AGENT_TOKEN || "";
const openClawAgentAuthHeader = process.env.OPENCLAW_AGENT_AUTH_HEADER || "Authorization";
const openClawAgentAuthScheme = process.env.OPENCLAW_AGENT_AUTH_SCHEME || "Bearer";
const openClawAgentTimeoutMs = Number(process.env.OPENCLAW_AGENT_TIMEOUT_MS || 60000);
const visionImageModelTarget = process.env.VISION_IMAGE_MODEL_TARGET || "gemini_vision";
const visionEventTypes = new Set([
  "gesture",
  "location",
  "motion",
  "image_snapshot",
  "spatial_json"
]);
const routeTargets = {
  LOCAL_RULES: "local_rules",
  MEDIAPIPE: "mediapipe",
  GEMINI_VISION: "gemini_vision",
  GPT_VISION: "gpt_vision",
  GROK_VISION: "grok_vision",
  AGENT_PLANNER: "agent_planner",
  CONTRACTOR_EVALUATOR: "contractor_evaluator",
  MEETING_NOTES_AGENT: "meeting_notes_agent",
  AGENT_RUNTIME: "agent_runtime"
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error("request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function createEventId() {
  return `vision_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createVoiceQueryId() {
  return `voice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function normalizeVisionEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("JSON body must be an object");
  }

  const type = event.type || "spatial_json";

  if (!visionEventTypes.has(type)) {
    throw new Error(`Unsupported vision event type: ${type}`);
  }

  return {
    id: event.id || createEventId(),
    channel: "vision",
    type,
    source: event.source || "iphone-web",
    intent: event.intent || null,
    domain: event.domain || null,
    scene: event.scene || null,
    receivedAt: new Date().toISOString(),
    camera: event.camera || null,
    microphone: event.microphone || null,
    location: event.location || null,
    motion: event.motion || null,
    gesture: event.gesture || null,
    imageSnapshot: event.imageSnapshot || event.image_snapshot || null,
    spatial: event.spatial || event.spatial_json || null,
    payload: event.payload || null,
    clientTimestamp: event.timestamp || null
  };
}

function routeVisionEvent(envelope) {
  const hint = getRouteHint(envelope);

  if (envelope.type === "gesture") {
    return buildRoute(envelope, routeTargets.MEDIAPIPE, "gesture_handler", "Gesture events are cheap local decisions.");
  }

  if (envelope.type === "motion") {
    return buildRoute(envelope, routeTargets.LOCAL_RULES, "motion_handler", "Device motion is handled by local rules first.");
  }

  if (envelope.type === "location") {
    return buildRoute(envelope, routeTargets.AGENT_RUNTIME, "location_context", "Location updates enrich agent context.");
  }

  if (envelope.type === "spatial_json") {
    return buildRoute(envelope, routeTargets.AGENT_PLANNER, "spatial_json_handler", "Spatial JSON is planning input, not raw media.");
  }

  if (envelope.type === "image_snapshot") {
    if (isContractorHint(hint)) {
      return buildRoute(envelope, routeTargets.CONTRACTOR_EVALUATOR, "construction_image_handler", "Construction imagery routes to contractor evaluation.");
    }

    if (isMeetingHint(hint)) {
      return buildRoute(envelope, routeTargets.MEETING_NOTES_AGENT, "meeting_screenshot_handler", "Meeting screenshots route to notes extraction.");
    }

    return buildRoute(envelope, visionImageModelTarget, "image_snapshot_handler", "General keyframes route to the configured vision model.");
  }

  return buildRoute(envelope, routeTargets.AGENT_RUNTIME, "fallback_handler", "Vision event falls back to agent runtime.");
}

function buildRoute(envelope, target, handler, reason) {
  return {
    channel: "vision",
    eventId: envelope.id,
    eventType: envelope.type,
    target,
    handler,
    reason
  };
}

function getRouteHint(envelope) {
  const payload = envelope.payload || {};
  const spatial = envelope.spatial || {};
  const imageSnapshot = envelope.imageSnapshot || {};

  return [
    envelope.intent,
    envelope.domain,
    envelope.scene,
    payload.intent,
    payload.domain,
    payload.scene,
    payload.label,
    spatial.intent,
    spatial.domain,
    spatial.scene,
    imageSnapshot.intent,
    imageSnapshot.domain,
    imageSnapshot.scene
  ].filter(Boolean).join(" ").toLowerCase();
}

function isContractorHint(hint) {
  return /\b(construction|contractor|site|defect|inspection|blueprint|floor\s*plan|施工|工地|装修)\b/.test(hint);
}

function isMeetingHint(hint) {
  return /\b(meeting|whiteboard|slide|slides|zoom|meet|teams|screenshot|会议|白板)\b/.test(hint);
}

async function forwardToOpenClaw(envelope, route) {
  if (!openClawVisionWebhookUrl) {
    return {
      configured: false,
      delivered: false
    };
  }

  const headers = {
    "content-type": "application/json"
  };

  if (openClawVisionWebhookToken) {
    headers.authorization = `Bearer ${openClawVisionWebhookToken}`;
  }

  const response = await fetch(openClawVisionWebhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...envelope,
      route
    })
  });

  return {
    configured: true,
    delivered: response.ok,
    status: response.status
  };
}

function buildOpenClawAgentHeaders() {
  if (!openClawAgentToken) {
    return {};
  }

  const value = openClawAgentAuthScheme
    ? `${openClawAgentAuthScheme} ${openClawAgentToken}`
    : openClawAgentToken;

  return {
    [openClawAgentAuthHeader]: value
  };
}

async function askOpenClawAgent(query) {
  if (!openClawAgentUrl) {
    return {
      ok: true,
      configured: false,
      reply: "Voice bridge is working. Set OPENCLAW_AGENT_URL on Cloud Run to send this question to OpenClaw.",
      raw: null
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openClawAgentTimeoutMs);

  try {
    const response = await fetch(openClawAgentUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...buildOpenClawAgentHeaders()
      },
      body: JSON.stringify(query),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        status: response.status,
        reply: "",
        error: `OpenClaw returned HTTP ${response.status}`,
        raw: payload
      };
    }

    return {
      ok: true,
      configured: true,
      status: response.status,
      reply: extractReply(payload) || "OpenClaw returned no reply text.",
      raw: extractReply(payload) ? null : payload
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      reply: "",
      error: error.name === "AbortError" ? "OpenClaw request timed out." : error.message,
      raw: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function serveStatic(req, res) {
  const requestedPath = new URL(req.url, "http://localhost").pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": contentTypes[ext] || "application/octet-stream",
      "cache-control": "no-store",
      "permissions-policy": "camera=(self), microphone=(self)",
      "x-content-type-options": "nosniff"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/voice-query") {
    try {
      const rawBody = await readBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const message = String(body.message || body.query || "").trim();

      if (!message) {
        sendJson(res, 400, {
          ok: false,
          error: "Message is required"
        });
        return;
      }

      const query = {
        id: body.id || createVoiceQueryId(),
        channel: "voice",
        type: "voice_query",
        source: body.source || "iphone-safari",
        message,
        location: body.location || null,
        context: body.context || null,
        timestamp: body.timestamp || new Date().toISOString()
      };
      const openclaw = await askOpenClawAgent(query);

      console.log("voice-query", {
        queryId: query.id,
        configured: openclaw.configured,
        ok: openclaw.ok,
        source: query.source,
        hasLocation: Boolean(query.location)
      });

      sendJson(res, openclaw.ok ? 200 : 502, {
        ok: openclaw.ok,
        queryId: query.id,
        configured: openclaw.configured,
        reply: openclaw.reply,
        error: openclaw.error,
        raw: openclaw.raw
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message
      });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/vision-event") {
    try {
      const rawBody = await readBody(req);
      const event = rawBody ? JSON.parse(rawBody) : {};
      const envelope = normalizeVisionEvent(event);
      const route = routeVisionEvent(envelope);
      const openclaw = await forwardToOpenClaw(envelope, route);

      console.log("vision-event", {
        eventId: envelope.id,
        type: envelope.type,
        source: envelope.source,
        route,
        openclaw,
        envelope
      });

      sendJson(res, 202, {
        ok: true,
        eventId: envelope.id,
        route,
        openclaw,
        message: "vision-event accepted"
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message
      });
    }
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { allow: "GET, HEAD, POST" });
  res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`OpenClaw vision site listening on ${port}`);
});
