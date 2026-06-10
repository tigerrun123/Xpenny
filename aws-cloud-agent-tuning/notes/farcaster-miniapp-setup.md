# Farcaster Mini App Setup

Date: 2026-06-10

Site:
- Public URL: `https://xpenny.netlify.app`
- Purpose: Farcaster Mini App / Frames entrypoint for the Xpenny prototype, without touching `xtoken2000.com`.

## Added Files

- `Xpenny/netlify.toml` keeps the Netlify site published from the `Xpenny` base directory and enables Netlify Functions from `Xpenny/netlify/functions`.
- `Xpenny/_redirects` maps friendly webhook paths to the Netlify Function.
- `Xpenny/.well-known/farcaster.json` defines the Mini App manifest.
- `Xpenny/netlify/functions/farcaster-webhook.js` receives Farcaster Mini App lifecycle events.
- `Xpenny/assets/xpenny-icon.svg`, `xpenny-preview.svg`, and `xpenny-splash.svg` provide Mini App visual assets.

## URLs

Mini App home:

```text
https://xpenny.netlify.app
```

Manifest:

```text
https://xpenny.netlify.app/.well-known/farcaster.json
```

Webhook:

```text
https://xpenny.netlify.app/api/farcaster/webhook
```

## Remaining Manual Step

The manifest still needs a real Farcaster `accountAssociation` signature. Generate it with the Farcaster Mini App manifest tool for `xpenny.netlify.app`, then replace these placeholders in `Xpenny/.well-known/farcaster.json`:

```text
GENERATE_WITH_FARCASTER_MANIFEST_TOOL
```

Do not commit private keys, seed phrases, custody wallet secrets, API keys, or user tokens.
