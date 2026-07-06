#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../skills/openclaw-runtime-commerce" && pwd)"
WORK="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
DEST="$WORK/skills/openclaw-runtime-commerce"

mkdir -p "$WORK/skills" "$HOME/bin"

if [ -d "$DEST" ]; then
  backup="$DEST.backup.$(date +%Y%m%d-%H%M%S)"
  mv "$DEST" "$backup"
  echo "Backed up existing skill to $backup"
fi

cp -a "$SRC_DIR" "$DEST"
chmod +x "$DEST"/bin/*.js
ln -sf "$DEST/bin/commerce-job.js" "$HOME/bin/commerce-job"
ln -sf "$DEST/bin/commerce-ledger.js" "$HOME/bin/commerce-ledger"
ln -sf "$DEST/bin/commerce-evaluate.js" "$HOME/bin/commerce-evaluate"

echo "Installed OpenClaw Runtime Commerce skill."
echo "Skill: $DEST"
echo "Try:"
echo "  commerce-job help"
echo "  commerce-job run --source test --source-user test:user --offering telegram_chat --agent main --amount 0.01 --token USDC --input 'hello' --dry-run"
