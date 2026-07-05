const video = document.querySelector("#preview");
const placeholder = document.querySelector("#placeholder");
const statusText = document.querySelector("#status");
const locationStatus = document.querySelector("#locationStatus");
const mediaStatus = document.querySelector("#mediaStatus");
const audioLevel = document.querySelector("#audioLevel");
const startButton = document.querySelector("#startButton");
const micButton = document.querySelector("#micButton");
const locationButton = document.querySelector("#locationButton");
const sceneSelect = document.querySelector("#sceneSelect");
const eventButton = document.querySelector("#eventButton");
const voiceForm = document.querySelector("#voiceForm");
const voiceInput = document.querySelector("#voiceInput");
const listenButton = document.querySelector("#listenButton");
const askButton = document.querySelector("#askButton");
const voiceStatus = document.querySelector("#voiceStatus");
const replyText = document.querySelector("#replyText");

let stream;
let latestLocation;
let speechRecognition;
let speechRecognitionSupported = false;
let audioContext;
let audioMeterFrame;

function setStatus(message) {
  statusText.textContent = message;
}

function setLocationStatus(message) {
  locationStatus.textContent = message;
}

function setMediaStatus(message) {
  mediaStatus.textContent = message;
}

function setVoiceStatus(message) {
  voiceStatus.textContent = message;
}

function detectSpeechRecognition() {
  speechRecognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!speechRecognitionSupported) {
    setVoiceStatus("Voice input is not available in this browser. Type your question, then tap Ask OpenClaw.");
    listenButton.disabled = true;
  }
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

  stopAudioMeter();
  setStatus("Requesting camera and microphone permission...");
  setMediaStatus("Requesting microphone...");

  try {
    stream = await requestMediaStream(true);

    video.srcObject = stream;
    placeholder.hidden = true;
    eventButton.disabled = false;
    startAudioMeter(stream);
    setStatus("Camera and microphone are active.");
  } catch (error) {
    const microphoneError = getErrorMessage(error);

    try {
      setStatus("Microphone was not granted. Requesting camera only...");
      stream = await requestMediaStream(false);
      video.srcObject = stream;
      placeholder.hidden = true;
      eventButton.disabled = false;
      setStatus("Camera is active.");
      setMediaStatus(`Microphone not active: ${microphoneError}. Tap Start mic to retry.`);
    } catch (fallbackError) {
      setStatus(`Media permission failed: ${getErrorMessage(fallbackError)}`);
      setMediaStatus(`Microphone not active: ${microphoneError}`);
    }
  }
}

function requestMediaStream(includeAudio) {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: includeAudio
      ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
      : false
  });
}

async function startMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMediaStatus("This browser does not support getUserMedia.");
    return;
  }

  stopAudioMeter();
  setMediaStatus("Requesting microphone...");

  try {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    const [audioTrack] = micStream.getAudioTracks();

    if (!audioTrack) {
      setMediaStatus("Microphone not active: no audio track returned.");
      return;
    }

    if (!stream) {
      stream = new MediaStream();
    }

    for (const oldTrack of stream.getAudioTracks()) {
      stream.removeTrack(oldTrack);
      oldTrack.stop();
    }

    stream.addTrack(audioTrack);
    startAudioMeter(stream);
    setMediaStatus("Microphone is active.");
  } catch (error) {
    setMediaStatus(`Microphone not active: ${getErrorMessage(error)}`);
  }
}

function getErrorMessage(error) {
  return error?.message || error?.name || "permission was not granted";
}

function getAudioTrackInfo() {
  const track = stream?.getAudioTracks()[0];

  if (!track) {
    return null;
  }

  return {
    label: track.label || null,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    settings: track.getSettings ? track.getSettings() : {}
  };
}

function stopAudioMeter() {
  if (audioMeterFrame) {
    cancelAnimationFrame(audioMeterFrame);
    audioMeterFrame = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  audioLevel.style.width = "0";
}

function startAudioMeter(mediaStream) {
  const audioTrack = mediaStream.getAudioTracks()[0];

  if (!audioTrack) {
    setMediaStatus("Microphone not active.");
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    setMediaStatus("Microphone is active. Audio meter is not supported in this browser.");
    return;
  }

  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
  const analyser = audioContext.createAnalyser();

  analyser.fftSize = 512;
  const samples = new Uint8Array(analyser.fftSize);
  source.connect(analyser);
  setMediaStatus("Microphone is active.");

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  function updateMeter() {
    analyser.getByteTimeDomainData(samples);

    let peak = 0;
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample - 128));
    }

    audioLevel.style.width = `${Math.min(100, Math.round((peak / 128) * 140))}%`;
    audioMeterFrame = requestAnimationFrame(updateMeter);
  }

  updateMeter();
}

async function sendVisionEvent() {
  const track = stream?.getVideoTracks()[0];
  const settings = track?.getSettings() || {};
  const microphone = getAudioTrackInfo();
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
        microphone,
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

function getSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  if (!speechRecognition) {
    speechRecognition = new SpeechRecognition();
    speechRecognition.lang = navigator.language || "en-US";
    speechRecognition.interimResults = true;
    speechRecognition.continuous = false;

    speechRecognition.addEventListener("result", (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("")
        .trim();

      if (transcript) {
        voiceInput.value = transcript;
      }
    });

    speechRecognition.addEventListener("audiostart", () => {
      setVoiceStatus("Microphone is listening...");
    });

    speechRecognition.addEventListener("speechstart", () => {
      setVoiceStatus("Speech detected...");
    });

    speechRecognition.addEventListener("nomatch", () => {
      setVoiceStatus("No speech was recognized. Try again or type your question.");
    });

    speechRecognition.addEventListener("end", () => {
      setVoiceStatus(voiceInput.value.trim() ? "Voice input captured." : "Listening ended. Try again or type your question.");
      listenButton.disabled = false;
    });

    speechRecognition.addEventListener("error", (event) => {
      setVoiceStatus(`Voice input failed: ${event.error}`);
      listenButton.disabled = false;
    });
  }

  return speechRecognition;
}

function startVoiceInput() {
  const recognition = getSpeechRecognition();

  if (!recognition) {
    setVoiceStatus("Speech recognition is not available in this browser. Type your question instead.");
    return;
  }

  listenButton.disabled = true;
  setVoiceStatus("Listening...");

  try {
    recognition.start();
  } catch (error) {
    listenButton.disabled = false;
    setVoiceStatus(`Voice input could not start: ${error.message}. Type your question instead.`);
  }
}

function speakReply(reply) {
  if (!window.speechSynthesis || !reply) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(reply);
  utterance.lang = navigator.language || "en-US";
  window.speechSynthesis.speak(utterance);
}

async function askOpenClaw(event) {
  event.preventDefault();

  const message = voiceInput.value.trim();

  if (!message) {
    setVoiceStatus("Ask a question first.");
    return;
  }

  askButton.disabled = true;
  setVoiceStatus("Asking OpenClaw...");

  try {
    const response = await fetch("/voice-query", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message,
        source: "iphone-safari",
        location: latestLocation || null,
        context: {
          scene: sceneSelect.value || "general"
        },
        timestamp: new Date().toISOString()
      })
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    replyText.textContent = payload.reply;
    setVoiceStatus(payload.configured ? "OpenClaw replied." : "Bridge is ready; OpenClaw URL is not configured yet.");
    speakReply(payload.reply);
  } catch (error) {
    setVoiceStatus(`OpenClaw query failed: ${error.message}`);
  } finally {
    askButton.disabled = false;
  }
}

startButton.addEventListener("click", startCamera);
micButton.addEventListener("click", startMicrophone);
locationButton.addEventListener("click", requestLocation);
eventButton.addEventListener("click", sendVisionEvent);
listenButton.addEventListener("click", startVoiceInput);
voiceForm.addEventListener("submit", askOpenClaw);
detectSpeechRecognition();
