const VISION_CHANNEL = "vision";

const VISION_EVENT_TYPES = new Set([
  "gesture",
  "location",
  "motion",
  "image_snapshot",
  "spatial_json"
]);

const { routeVisionEvent } = require("./model-router");

function createVisionEventId(now = Date.now()) {
  return `vision_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeVisionEvent(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Vision event must be a JSON object");
  }

  const type = input.type || options.defaultType || "spatial_json";

  if (!VISION_EVENT_TYPES.has(type)) {
    throw new Error(`Unsupported vision event type: ${type}`);
  }

  return {
    id: input.id || createVisionEventId(options.now),
    channel: VISION_CHANNEL,
    type,
    source: input.source || "iphone-web",
    receivedAt: new Date(options.now || Date.now()).toISOString(),
    camera: input.camera || null,
    location: input.location || null,
    motion: input.motion || null,
    gesture: input.gesture || null,
    imageSnapshot: input.imageSnapshot || input.image_snapshot || null,
    spatial: input.spatial || input.spatial_json || null,
    payload: input.payload || null,
    clientTimestamp: input.timestamp || input.clientTimestamp || null
  };
}

module.exports = {
  VISION_CHANNEL,
  VISION_EVENT_TYPES,
  normalizeVisionEvent,
  routeVisionEvent
};
