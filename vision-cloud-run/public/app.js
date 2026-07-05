const video = document.querySelector("#preview");
const placeholder = document.querySelector("#placeholder");
const statusText = document.querySelector("#status");
const locationStatus = document.querySelector("#locationStatus");
const startButton = document.querySelector("#startButton");
const locationButton = document.querySelector("#locationButton");
const sceneSelect = document.querySelector("#sceneSelect");
const eventButton = document.querySelector("#eventButton");

let stream;
let latestLocation;

function setStatus(message) {
  statusText.textContent = message;
}

function setLocationStatus(message) {
  locationStatus.textContent = message;
}

function requestLocation() {
  if (!navigator.geolocation) {
    setLocationStatus("This browser does not support GPS location.");
    return;
  }

  setLocationStatus("Requesting GPS permission...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      latestLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: new Date(position.timestamp).toISOString()
      };

      const lat = latestLocation.latitude.toFixed(6);
      const lon = latestLocation.longitude.toFixed(6);
      const accuracy = Math.round(latestLocation.accuracy);

      setLocationStatus(`GPS active: ${lat}, ${lon} +/- ${accuracy}m.`);
      eventButton.disabled = false;
    },
    (error) => {
      setLocationStatus(`GPS permission failed: ${error.message}`);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("This browser does not support getUserMedia.");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = stream;
    placeholder.hidden = true;
    eventButton.disabled = false;
    setStatus("Camera is active.");
  } catch (error) {
    setStatus(`Camera permission failed: ${error.message}`);
  }
}

async function sendVisionEvent() {
  const track = stream?.getVideoTracks()[0];
  const settings = track?.getSettings() || {};
  const imageSnapshot = captureImageSnapshot();
  const scene = sceneSelect.value;
  const eventType = scene === "spatial" ? "spatial_json" : imageSnapshot ? "image_snapshot" : "location";

  try {
    const response = await fetch("/vision-event", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: eventType,
        source: "iphone-safari",
        scene: scene || null,
        camera: settings,
        location: latestLocation || null,
        imageSnapshot,
        spatial_json: scene === "spatial" ? buildSpatialJson() : null,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const target = payload.route?.target || "OpenClaw";
    setStatus(`Event sent to ${target}.`);
  } catch (error) {
    setStatus(`Event send failed: ${error.message}`);
  }
}

function buildSpatialJson() {
  return {
    scene: "spatial",
    coordinateSystem: "camera-relative",
    anchors: [],
    observations: [],
    note: "Client-side spatial pipeline placeholder"
  };
}

function captureImageSnapshot() {
  if (!stream || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);

  return {
    mimeType: "image/jpeg",
    dataUrl: canvas.toDataURL("image/jpeg", 0.72),
    width,
    height
  };
}

startButton.addEventListener("click", startCamera);
locationButton.addEventListener("click", requestLocation);
eventButton.addEventListener("click", sendVisionEvent);
