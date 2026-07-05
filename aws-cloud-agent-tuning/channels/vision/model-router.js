const DEFAULT_IMAGE_MODEL_TARGET = "gemini_vision";

const ROUTE_TARGETS = {
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

function routeVisionEvent(event, options = {}) {
  const imageModelTarget = options.imageModelTarget || DEFAULT_IMAGE_MODEL_TARGET;
  const hint = getRouteHint(event);

  if (event.type === "gesture") {
    return buildRoute(event, ROUTE_TARGETS.MEDIAPIPE, "gesture_handler", "Gesture events are cheap local decisions.");
  }

  if (event.type === "motion") {
    return buildRoute(event, ROUTE_TARGETS.LOCAL_RULES, "motion_handler", "Device motion is handled by local rules first.");
  }

  if (event.type === "location") {
    return buildRoute(event, ROUTE_TARGETS.AGENT_RUNTIME, "location_context", "Location updates enrich agent context.");
  }

  if (event.type === "spatial_json") {
    return buildRoute(event, ROUTE_TARGETS.AGENT_PLANNER, "spatial_json_handler", "Spatial JSON is planning input, not raw media.");
  }

  if (event.type === "image_snapshot") {
    if (isContractorHint(hint)) {
      return buildRoute(event, ROUTE_TARGETS.CONTRACTOR_EVALUATOR, "construction_image_handler", "Construction imagery routes to contractor evaluation.");
    }

    if (isMeetingHint(hint)) {
      return buildRoute(event, ROUTE_TARGETS.MEETING_NOTES_AGENT, "meeting_screenshot_handler", "Meeting screenshots route to notes extraction.");
    }

    return buildRoute(event, imageModelTarget, "image_snapshot_handler", "General keyframes route to the configured vision model.");
  }

  return buildRoute(event, ROUTE_TARGETS.AGENT_RUNTIME, "fallback_handler", "Unknown vision event shape falls back to agent runtime.");
}

function buildRoute(event, target, handler, reason) {
  return {
    channel: "vision",
    eventId: event.id,
    eventType: event.type,
    target,
    handler,
    reason
  };
}

function getRouteHint(event) {
  const payload = event.payload || {};
  const spatial = event.spatial || {};
  const imageSnapshot = event.imageSnapshot || {};

  return [
    event.intent,
    event.domain,
    event.scene,
    event.label,
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
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isContractorHint(hint) {
  return /\b(construction|contractor|site|defect|inspection|blueprint|floor\s*plan|施工|工地|装修)\b/.test(hint);
}

function isMeetingHint(hint) {
  return /\b(meeting|whiteboard|slide|slides|zoom|meet|teams|screenshot|会议|白板)\b/.test(hint);
}

module.exports = {
  DEFAULT_IMAGE_MODEL_TARGET,
  ROUTE_TARGETS,
  routeVisionEvent
};
