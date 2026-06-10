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
