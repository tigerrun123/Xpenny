# OpenClaw Vision Channel

`channels/vision` is the inbound channel for iPhone/browser sensor events.

Stage 2 formalizes the webhook events from the iPhone page into five event
types:

- `gesture`
- `location`
- `motion`
- `image_snapshot`
- `spatial_json`

## Event Envelope

Every event should be normalized before it enters OpenClaw runtime logic:

```json
{
  "id": "vision_mr7446p7_yykhcx3q",
  "channel": "vision",
  "type": "location",
  "source": "iphone-safari",
  "receivedAt": "2026-07-05T01:00:00.000Z",
  "camera": null,
  "location": {
    "latitude": -33.8688,
    "longitude": 151.2093,
    "accuracy": 25,
    "timestamp": "2026-07-05T01:00:00.000Z"
  },
  "motion": null,
  "gesture": null,
  "imageSnapshot": null,
  "spatial": null,
  "payload": null,
  "clientTimestamp": "2026-07-05T01:00:00.000Z"
}
```

## Current Transport

The current transport is:

```http
POST /vision-event
```

The Cloud Run bridge receives browser events, normalizes them into this channel
envelope, logs them, and can optionally forward them to a real OpenClaw endpoint
with:

```sh
OPENCLAW_VISION_WEBHOOK_URL=https://your-openclaw-host.example.com/vision-event
OPENCLAW_VISION_WEBHOOK_TOKEN=optional-secret-token
```

## Event Type Notes

`gesture`
: High-level user action or vision-recognized gesture, such as `pinch`,
`point`, `tap`, `open_hand`, or `thumbs_up`.

`location`
: GPS coordinates from the browser Geolocation API.

`motion`
: Device motion/orientation values from iOS browser motion APIs. iOS requires a
user gesture and explicit permission before these APIs return data.

`image_snapshot`
: A still frame or image-derived observation from the iPhone camera. Keep
snapshots small at the channel layer; store large media elsewhere and send a
URL/reference.

`spatial_json`
: Structured scene/spatial output from a client-side or native vision pipeline,
for example detected objects, landmarks, depth-derived positions, or AR anchors.

## Stage 3: Multimodal Router

The Vision Channel does not send a continuous video stream into OpenClaw.
It sends visual events, keyframes, and spatial JSON. The router decides the
cheapest useful handler for each event.

```text
OpenClaw
├── Telegram Channel
├── Voice Channel
├── Vision Channel
│   ├── event receiver
│   ├── image snapshot handler
│   ├── spatial JSON handler
│   └── model router
└── Agent Runtime
```

Default routing:

| Input | Target | Handler |
| --- | --- | --- |
| `gesture` | `mediapipe` / local rules | `gesture_handler` |
| `motion` | `local_rules` | `motion_handler` |
| `location` | `agent_runtime` | `location_context` |
| general `image_snapshot` | `gemini_vision` by default | `image_snapshot_handler` |
| construction `image_snapshot` | `contractor_evaluator` | `construction_image_handler` |
| meeting screenshot `image_snapshot` | `meeting_notes_agent` | `meeting_screenshot_handler` |
| `spatial_json` | `agent_planner` | `spatial_json_handler` |

The image model target can later be switched to `gpt_vision` or `grok_vision`
by configuration. The first implementation keeps routing deterministic and
cheap; model calls happen behind the selected handler, not at the channel edge.
