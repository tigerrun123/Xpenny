# Xpenny

Xpenny is a small static website and Farcaster Mini App prototype for practicing
agent-driven token simulation workflows.

## Project idea

The site presents an XPEN token simulation where agents interact through X-like
social actions: posts, calls, likes, replies, reputation, and yield cycles. It
also introduces Sites for generating shareable interactive web apps from any
content, plus Annotations for precise circle-and-edit changes.

## Files

- `index.html` - page structure
- `styles.css` - visual design
- `script.js` - simple interactive token simulation
- `.well-known/farcaster.json` - Farcaster Mini App manifest
- `assets/` - Mini App icon, preview, and splash assets

## Local preview

Open `index.html` in a browser, or run a simple static server from this folder.

```sh
python3 -m http.server 5173
```

Then visit:

```text
http://localhost:5173
```

## Git flow

```sh
git status
git add Xpenny
git commit -m "Add Xpenny prototype"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

After connecting the GitHub repository to Netlify, each push to `main` can
update the deployed website.

## Farcaster Mini App

Public URL:

```text
https://xpenny.netlify.app
```

Manifest URL:

```text
https://xpenny.netlify.app/.well-known/farcaster.json
```

The manifest needs a real Farcaster `accountAssociation` signature before the
mini app is production-ready.

## OpenClaw Bridge

The Mini App includes an `Ask OpenClaw` panel. Browser messages go to:

```text
/api/openclaw/chat
```

That path is served by `netlify/functions/openclaw-chat.js`, which forwards to
AWS only when these Netlify environment variables are configured:

```text
OPENCLAW_AGENT_URL=<AWS OpenClaw bridge endpoint>
OPENCLAW_AGENT_TOKEN=<optional shared token>
```

Keep OpenClaw tokens and AWS bridge secrets in Netlify environment variables,
not in the frontend.

The Mini App also accepts a cast query parameter:

```text
https://xpenny.netlify.app?q=tiger%20menu%20please
```

When `q` is present, the Mini App opens and sends that question to OpenClaw
automatically.

## Neynar Mention Webhook

`POST /api/neynar/mention` is for the Farcaster mention flow:

```text
@xtoken123 tiger menu please
```

The Netlify Function extracts the prompt, queues a background OpenClaw job, and
returns quickly to Neynar. The background function asks AWS OpenClaw, then posts
the answer directly as an `@xtoken123` reply. The reply also includes an
`Open Xpenny` Mini App link containing `?q=...`.

Netlify environment variables:

```text
NEYNAR_API_KEY=<Neynar API key>
NEYNAR_SIGNER_UUID=<Neynar signer for @xtoken123>
NEYNAR_BOT_USERNAME=xtoken123
NEYNAR_BOT_FID=3313201
NEYNAR_WEBHOOK_SECRET=<optional Neynar webhook secret>
NEYNAR_MENTION_SYNC_OPENCLAW=false
```
