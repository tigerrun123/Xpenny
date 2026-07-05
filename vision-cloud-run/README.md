# OpenClaw Vision Cloud Run Site

Small HTTPS-ready Cloud Run service for `openclawai.live`.

## Stage 1: iPhone Vision Webhook

The iPhone page sends camera/GPS events to:

```http
POST /vision-event
content-type: application/json
```

Example payload:

```json
{
  "type": "image_snapshot",
  "source": "iphone-safari",
  "camera": {
    "width": 1280,
    "height": 720,
    "facingMode": "environment"
  },
  "location": {
    "latitude": -33.8688,
    "longitude": 151.2093,
    "accuracy": 25,
    "timestamp": "2026-07-05T01:00:00.000Z"
  },
  "imageSnapshot": {
    "mimeType": "image/jpeg",
    "dataUrl": "data:image/jpeg;base64,...",
    "width": 640,
    "height": 360
  },
  "timestamp": "2026-07-05T01:00:00.000Z"
}
```

Allowed event types:

- `gesture`
- `location`
- `motion`
- `image_snapshot`
- `spatial_json`

The service wraps the payload in an event envelope, logs it, and returns:

```json
{
  "ok": true,
  "eventId": "vision_...",
  "openclaw": {
    "configured": false,
    "delivered": false
  },
  "message": "vision-event accepted"
}
```

To forward each event to a real OpenClaw webhook later, set:

```sh
OPENCLAW_VISION_WEBHOOK_URL=https://your-openclaw-host.example.com/vision-event
OPENCLAW_VISION_WEBHOOK_TOKEN=optional-secret-token
```

## Stage 3: Multimodal Router

`POST /vision-event` now returns the selected route:

```json
{
  "ok": true,
  "eventId": "vision_...",
  "route": {
    "channel": "vision",
    "eventType": "image_snapshot",
    "target": "gemini_vision",
    "handler": "image_snapshot_handler"
  }
}
```

Default routing:

- `gesture` -> `mediapipe` / local rules
- `motion` -> `local_rules`
- `location` -> `agent_runtime`
- general `image_snapshot` -> `gemini_vision`
- construction `image_snapshot` -> `contractor_evaluator`
- meeting `image_snapshot` -> `meeting_notes_agent`
- `spatial_json` -> `agent_planner`

Set `VISION_IMAGE_MODEL_TARGET=gpt_vision` or `grok_vision` to switch the
default image model target.

## Voice Query Bridge

The browser page requests iPhone media with `getUserMedia({ video, audio })`.
That gives the page camera and microphone tracks after the user grants permission.
The media tracks are separate from the semantic OpenClaw query path:

- Camera frames become `image_snapshot` vision events.
- Microphone access is shown with an audio meter and attached as track metadata.
- Speech recognition, when available in the browser, turns spoken words into text.
- The text question is sent to OpenClaw through `/voice-query`.

The browser page exposes the voice/text query path:

```http
POST /voice-query
content-type: application/json
```

Example payload:

```json
{
  "message": "What restaurant is near me?",
  "source": "iphone-safari",
  "location": {
    "latitude": -33.8688,
    "longitude": 151.2093,
    "accuracy": 25
  },
  "context": {
    "scene": "general"
  }
}
```

Configure the real OpenClaw endpoint only on the server:

```sh
OPENCLAW_AGENT_URL=https://your-openclaw-host.example.com/bridge
OPENCLAW_AGENT_TOKEN=optional-secret-token
OPENCLAW_AGENT_TIMEOUT_MS=60000
```

## Local run

```sh
npm start
```

Open `http://localhost:8080`.

## Deploy to Cloud Run

```sh
gcloud auth login
gcloud config set project PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
gcloud run deploy openclaw-vision \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## Map domain

```sh
gcloud domains list-user-verified
gcloud domains verify openclawai.live
gcloud beta run domain-mappings create \
  --service openclaw-vision \
  --domain openclawai.live \
  --region us-central1
gcloud beta run domain-mappings describe \
  --domain openclawai.live \
  --region us-central1
```

Add the returned DNS records at your domain registrar. After DNS propagates,
Google issues and renews the HTTPS certificate automatically.
