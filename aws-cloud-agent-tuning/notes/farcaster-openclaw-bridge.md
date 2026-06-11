# Farcaster Mini App to OpenClaw Bridge

Date: 2026-06-11

Goal:

```text
Farcaster Mini App -> Netlify Function -> AWS Lightsail OpenClaw
```

Mention flow:

```text
Cast mentions @xtoken123
  -> Neynar webhook
  -> Netlify /api/neynar/mention
  -> AWS Lightsail OpenClaw
  -> Neynar reply cast with https://xpenny.netlify.app?q=...
```

## Implemented on the Mini App Side

- Added an `Ask OpenClaw` panel to the Xpenny Mini App.
- Added `POST /api/openclaw/chat` via Netlify redirect.
- Added `Xpenny/netlify/functions/openclaw-chat.js`.
- Added `?q=` Mini App deep-link support so a reply cast can open Xpenny and
  run the prompt automatically.
- Added `POST /api/neynar/mention` for @mention automation through Neynar.

The browser never receives the OpenClaw token. It only calls the Netlify Function.

## Netlify Environment Variables

Required when the AWS bridge is ready:

```text
OPENCLAW_AGENT_URL=<public HTTPS endpoint for AWS OpenClaw bridge>
```

Optional:

```text
OPENCLAW_AGENT_TOKEN=<shared auth token for the bridge>
OPENCLAW_AGENT_AUTH_HEADER=Authorization
OPENCLAW_AGENT_AUTH_SCHEME=Bearer
OPENCLAW_AGENT_TIMEOUT_MS=25000
```

For Neynar mention replies:

```text
NEYNAR_API_KEY=<Neynar API key>
NEYNAR_SIGNER_UUID=<Neynar signer UUID for @xtoken123>
NEYNAR_BOT_USERNAME=xtoken123
NEYNAR_WEBHOOK_SECRET=<optional Neynar webhook secret>
```

Configure the Neynar webhook to call:

```text
https://xpenny.netlify.app/api/neynar/mention
```

Use a `cast.created` webhook filtered to casts that mention the bot FID.

## AWS Side Still Needed

OpenClaw on the Lightsail instance currently runs behind its own local gateway/channel setup. To let Netlify call it safely, create a small public HTTPS bridge on the AWS instance or behind a tunnel/reverse proxy.

Recommended shape:

```text
POST /xpenny-agent
Authorization: Bearer <shared token>
Content-Type: application/json

{
  "message": "user message",
  "source": "xpenny-farcaster-miniapp"
}
```

Expected reply:

```json
{
  "reply": "agent response text"
}
```

Security notes:

- Do not expose raw OpenClaw gateway tokens to the browser.
- Prefer HTTPS.
- Require a shared bearer token on the AWS bridge.
- Keep AWS firewall rules tight; only expose the bridge port if needed.
- If using a tunnel, keep the tunnel token out of git.
