# Cesium x Google Agent Ride

MVP for a 3D route simulator that combines CesiumJS, Google Street View, and an agent-style planning layer.

The demo opens directly into a Sydney ride from Circular Quay to Martin Place. CesiumJS renders the 3D route and rider marker. The Street View panel works in fallback mode without credentials, and switches to live Google Street View when you enter a Google Maps JavaScript API key.

## Run

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 5173
```

Then visit:

```text
http://localhost:5173
```

## Google APIs to enable

- Maps JavaScript API, for `StreetViewPanorama`
- Routes API, for production route planning
- Street View Static API, only if you want static image thumbnails instead of interactive panorama

For production, route requests should go through your backend so API keys and billing controls are not exposed.

## Agent integration shape

The current `src/app.js` includes a local `createPlan()` function that mimics the response your Google ADK / Gemini Enterprise Agent Platform agent should return.

Suggested agent response:

```json
{
  "intent": "street_view_ride",
  "origin": "Circular Quay, Sydney",
  "destination": "Martin Place, Sydney",
  "travelMode": "BICYCLE",
  "actions": [
    "compute_route",
    "sample_polyline_every_30m",
    "lookup_nearest_street_view_panorama",
    "animate_cesium_camera",
    "sync_street_view_heading",
    "generate_tour_narration"
  ]
}
```

Production flow:

1. Browser sends the user's natural-language prompt to your agent endpoint.
2. Agent extracts origin, destination, travel mode, and experience style.
3. Backend calls Google Routes API and decodes the returned polyline.
4. Backend samples route points and optionally enriches them with places, notes, or narration.
5. Browser receives route geometry and renders it in Cesium while syncing Street View.

## Files

- `index.html` - app shell
- `styles.css` - responsive UI
- `src/app.js` - Cesium route, playback, Street View loading, local agent-plan mock
