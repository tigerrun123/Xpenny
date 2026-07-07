const routePoints = [
  {
    name: "Circular Quay",
    lat: -33.86109,
    lng: 151.21072,
    note: "Starting beside the ferry wharves, facing south toward the CBD.",
  },
  {
    name: "Alfred Street",
    lat: -33.86221,
    lng: 151.21018,
    note: "The route leaves the harbour edge and moves into the city grid.",
  },
  {
    name: "Loftus Street",
    lat: -33.86318,
    lng: 151.20972,
    note: "A short city segment with sandstone buildings and office towers nearby.",
  },
  {
    name: "Bridge Street",
    lat: -33.86438,
    lng: 151.20928,
    note: "Crossing a busy east-west corridor in central Sydney.",
  },
  {
    name: "Pitt Street",
    lat: -33.86577,
    lng: 151.20832,
    note: "The ride turns deeper into the central business district.",
  },
  {
    name: "Martin Place",
    lat: -33.86772,
    lng: 151.20707,
    note: "Arriving at the pedestrian spine of Martin Place.",
  },
];

const state = {
  viewer: null,
  marker: null,
  routePositions: [],
  playing: false,
  progress: 0,
  speed: 1.2,
  lastTick: null,
  streetView: null,
  googleLoaded: false,
  stopView: false,
};

const els = {
  playPause: document.querySelector("#playPause"),
  resetRide: document.querySelector("#resetRide"),
  streetStop: document.querySelector("#streetStop"),
  speedRange: document.querySelector("#speedRange"),
  progressLabel: document.querySelector("#progressLabel"),
  streetTitle: document.querySelector("#streetTitle"),
  streetStep: document.querySelector("#streetStep"),
  streetHeading: document.querySelector("#streetHeading"),
  streetCopy: document.querySelector("#streetCopy"),
  openMaps: document.querySelector("#openMaps"),
  mapsKey: document.querySelector("#mapsKey"),
  loadGoogle: document.querySelector("#loadGoogle"),
  agentForm: document.querySelector("#agentForm"),
  agentPrompt: document.querySelector("#agentPrompt"),
  originValue: document.querySelector("#originValue"),
  destinationValue: document.querySelector("#destinationValue"),
  modeValue: document.querySelector("#modeValue"),
  agentJson: document.querySelector("#agentJson"),
  routeMeta: document.querySelector("#routeMeta"),
};

function createPlan(prompt) {
  const text = prompt.toLowerCase();
  const mode = text.includes("walk") || text.includes("走") ? "WALK" : "BICYCLE";
  const plan = {
    intent: "street_view_ride",
    origin: "Circular Quay, Sydney",
    destination: "Martin Place, Sydney",
    travelMode: mode,
    engine: {
      globe: "CesiumJS",
      routeProvider: "Google Routes API",
      streetViewProvider: "Google Maps JavaScript StreetViewPanorama",
      agentRuntime: "Google ADK / Gemini Enterprise Agent Platform",
    },
    actions: [
      "compute_route",
      "sample_polyline_every_30m",
      "lookup_nearest_street_view_panorama",
      "animate_cesium_camera",
      "pause_at_shopfront_street_view",
      "sync_street_view_heading",
      "generate_tour_narration",
    ],
  };

  return plan;
}

function initCesium() {
  Cesium.Ion.defaultAccessToken = "";

  state.viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  });

  state.viewer.imageryLayers.removeAll();
  state.viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      credit: "Tiles © Esri",
    }),
  );

  state.viewer.scene.globe.enableLighting = true;
  state.viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
  state.viewer.scene.screenSpaceCameraController.maximumZoomDistance = 150000;

  state.routePositions = routePoints.map((point) =>
    Cesium.Cartesian3.fromDegrees(point.lng, point.lat, 24),
  );

  state.viewer.entities.add({
    name: "Bike route",
    polyline: {
      positions: state.routePositions,
      width: 7,
      material: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.fromCssColorString("#38d39f"),
        glowPower: 0.22,
      }),
      clampToGround: false,
    },
  });

  routePoints.forEach((point, index) => {
    state.viewer.entities.add({
      name: point.name,
      position: state.routePositions[index],
      point: {
        pixelSize: index === 0 || index === routePoints.length - 1 ? 12 : 7,
        color:
          index === 0
            ? Cesium.Color.fromCssColorString("#38d39f")
            : index === routePoints.length - 1
              ? Cesium.Color.fromCssColorString("#e8c55a")
              : Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
      label: {
        text: point.name,
        font: "13px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -24),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  });

  state.marker = state.viewer.entities.add({
    name: "Rider",
    position: state.routePositions[0],
    billboard: {
      image: createBikeSvg(),
      width: 42,
      height: 42,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  state.viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(151.2088, -33.8647, 1700),
    orientation: {
      heading: Cesium.Math.toRadians(24),
      pitch: Cesium.Math.toRadians(-54),
      roll: 0,
    },
    duration: 1.2,
  });
}

function createBikeSvg() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="28" fill="#38d39f" opacity="0.18"/>
      <circle cx="22" cy="42" r="8" fill="none" stroke="#f4f0e8" stroke-width="4"/>
      <circle cx="44" cy="42" r="8" fill="none" stroke="#f4f0e8" stroke-width="4"/>
      <path d="M22 42 30 30h10l4 12M30 30l-4 12h18M36 24h8" fill="none" stroke="#38d39f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="19" r="5" fill="#e8c55a"/>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function interpolateRoute(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  const scaled = clamped * (routePoints.length - 1);
  const index = Math.min(routePoints.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const start = routePoints[index];
  const end = routePoints[index + 1];
  return {
    index,
    local,
    lat: start.lat + (end.lat - start.lat) * local,
    lng: start.lng + (end.lng - start.lng) * local,
    heading: bearing(start, end),
    nearest: local < 0.5 ? start : end,
  };
}

function bearing(start, end) {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const phi1 = start.lat * toRad;
  const phi2 = end.lat * toRad;
  const delta = (end.lng - start.lng) * toRad;
  const y = Math.sin(delta) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(delta);
  return (Math.atan2(y, x) * toDeg + 360) % 360;
}

function updateRide(progress, moveCamera = false) {
  state.progress = Math.max(0, Math.min(1, progress));
  const ride = interpolateRoute(state.progress);
  const position = Cesium.Cartesian3.fromDegrees(ride.lng, ride.lat, 26);

  state.marker.position = position;
  els.progressLabel.textContent = `${Math.round(state.progress * 100)}%`;

  if (moveCamera) {
    setRideCamera(ride);
  }

  updateStreetView(ride);
}

function setRideCamera(ride) {
  const height = state.stopView ? 38 : 520;
  const pitch = state.stopView ? -8 : -44;
  const headingOffset = state.stopView ? 10 : 0;

  state.viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(ride.lng, ride.lat, height),
    orientation: {
      heading: Cesium.Math.toRadians(ride.heading + headingOffset),
      pitch: Cesium.Math.toRadians(pitch),
      roll: 0,
    },
  });
}

function updateStreetView(ride) {
  const point = ride.nearest;
  els.streetTitle.textContent = point.name;
  els.streetStep.textContent = point.name;
  els.streetHeading.textContent = `Heading ${Math.round(ride.heading)}°`;
  els.streetCopy.textContent = state.stopView
    ? `Bike stopped near ${point.name}. Street-side view is focused on shopfronts, footpath, and the road edge.`
    : point.note;
  els.openMaps.onclick = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${ride.lat},${ride.lng}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (state.streetView) {
    state.streetView.setPosition({ lat: ride.lat, lng: ride.lng });
    state.streetView.setPov({ heading: ride.heading, pitch: 2 });
  }
}

function tick(timestamp) {
  if (!state.playing) {
    state.lastTick = null;
    return;
  }

  if (state.lastTick === null) {
    state.lastTick = timestamp;
  }

  const delta = Math.min(80, timestamp - state.lastTick);
  state.lastTick = timestamp;
  updateRide(state.progress + (delta / 45000) * state.speed, true);

  if (state.progress >= 1) {
    state.playing = false;
    els.playPause.textContent = "▶";
    return;
  }

  requestAnimationFrame(tick);
}

function toggleRide() {
  state.stopView = false;
  els.streetStop.classList.remove("active");
  state.playing = !state.playing;
  els.playPause.textContent = state.playing ? "Ⅱ" : "▶";
  if (state.playing) {
    requestAnimationFrame(tick);
  }
}

function resetRide() {
  state.playing = false;
  state.stopView = false;
  state.lastTick = null;
  els.playPause.textContent = "▶";
  els.streetStop.classList.remove("active");
  updateRide(0, true);
}

function showStreetStop() {
  state.playing = false;
  state.stopView = true;
  state.lastTick = null;
  els.playPause.textContent = "▶";
  els.streetStop.classList.add("active");
  updateRide(0.78, true);
}

function loadGoogleMaps() {
  const key = els.mapsKey.value.trim();
  if (!key) {
    els.mapsKey.focus();
    return;
  }

  localStorage.setItem("googleMapsApiKey", key);
  if (window.google?.maps) {
    initStreetView();
    return;
  }

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
  script.async = true;
  script.defer = true;
  script.onload = initStreetView;
  script.onerror = () => {
    els.streetCopy.textContent = "Google Maps failed to load. Check API key and allowed domains.";
  };
  document.head.appendChild(script);
}

function initStreetView() {
  const ride = interpolateRoute(state.progress);
  state.googleLoaded = true;
  state.streetView = new google.maps.StreetViewPanorama(document.querySelector("#streetView"), {
    position: { lat: ride.lat, lng: ride.lng },
    pov: { heading: ride.heading, pitch: 2 },
    zoom: 1,
    addressControl: false,
    fullscreenControl: false,
    motionTracking: false,
    motionTrackingControl: false,
    showRoadLabels: true,
  });
  document.querySelector("#streetView").classList.add("live");
}

function renderPlan(plan) {
  els.originValue.textContent = plan.origin;
  els.destinationValue.textContent = plan.destination;
  els.modeValue.textContent = plan.travelMode;
  els.routeMeta.textContent = `${plan.travelMode.toLowerCase()} · Cesium + Street View sync`;
  els.agentJson.textContent = JSON.stringify(plan, null, 2);
}

function bindEvents() {
  els.playPause.addEventListener("click", toggleRide);
  els.resetRide.addEventListener("click", resetRide);
  els.streetStop.addEventListener("click", showStreetStop);
  els.speedRange.addEventListener("input", () => {
    state.speed = Number(els.speedRange.value);
  });
  els.loadGoogle.addEventListener("click", loadGoogleMaps);
  els.agentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderPlan(createPlan(els.agentPrompt.value));
  });

  const storedKey = localStorage.getItem("googleMapsApiKey");
  if (storedKey) {
    els.mapsKey.value = storedKey;
  }
}

function boot() {
  if (!window.Cesium) {
    document.body.innerHTML = "<p>Cesium failed to load. Check your network connection.</p>";
    return;
  }

  initCesium();
  bindEvents();
  renderPlan(createPlan(els.agentPrompt.value));
  updateRide(0);
}

boot();
