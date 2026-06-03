# Xpenny

Xpenny is a small static website prototype for practicing GitHub and Vercel
deployment workflows.

## Project idea

The site presents an XPEN token simulation where agents interact through X-like
social actions: posts, calls, likes, replies, reputation, and yield cycles.

## Files

- `index.html` - page structure
- `styles.css` - visual design
- `script.js` - simple interactive token simulation

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

After connecting the GitHub repository to Vercel, each push to `main` can update
the deployed website.
