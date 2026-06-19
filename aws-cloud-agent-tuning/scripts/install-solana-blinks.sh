#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  install-solana-blinks.sh --base-url https://HOST --recipient SOLANA_PUBLIC_KEY [--rpc-url HTTPS_URL]

Installs the Solana Blink plugin and Telegram-facing OpenClaw skill. No private key is used.
EOF
}

BASE_URL=""
RECIPIENT=""
RPC_URL="https://api.mainnet-beta.solana.com"

while (($#)); do
  case "$1" in
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    --recipient) RECIPIENT="${2:-}"; shift 2 ;;
    --rpc-url) RPC_URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ ! "$BASE_URL" =~ ^https://[^[:space:]]+$ ]]; then
  echo "--base-url must be a public HTTPS URL" >&2
  exit 2
fi
if [[ ! "$RECIPIENT" =~ ^[1-9A-HJ-NP-Za-km-z]{32,44}$ ]]; then
  echo "--recipient does not look like a Solana public key" >&2
  exit 2
fi
if [[ ! "$RPC_URL" =~ ^https://[^[:space:]]+$ ]]; then
  echo "--rpc-url must be HTTPS" >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN="$ROOT/plugins/solana-blinks"
SKILL="$ROOT/skills/solana-blinks"
WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
DROPIN="$HOME/.config/systemd/user/openclaw-gateway.service.d"

command -v openclaw >/dev/null || { echo "openclaw is not installed" >&2; exit 1; }
command -v node >/dev/null || { echo "node is not installed" >&2; exit 1; }

BLINK_URL="$(node -e 'const endpoint=process.argv[1]+"/api/actions/pay"; console.log("https://dial.to/?action="+encodeURIComponent("solana-action:"+endpoint))' "$BASE_URL")"

openclaw plugins install "$PLUGIN" --force
openclaw plugins enable solana-blinks

mkdir -p "$WORKSPACE/.openclaw/skills/solana-blinks" "$DROPIN"
cp "$SKILL/SKILL.md" "$WORKSPACE/.openclaw/skills/solana-blinks/SKILL.md"
sed -i "s|__SOLANA_BLINK_BASE_URL__|$BASE_URL|g" "$WORKSPACE/.openclaw/skills/solana-blinks/SKILL.md"
sed -i "s|__SOLANA_BLINK_INTERSTITIAL_URL__|$BLINK_URL|g" "$WORKSPACE/.openclaw/skills/solana-blinks/SKILL.md"

cat > "$DROPIN/solana-blinks.conf" <<EOF
[Service]
Environment="SOLANA_BLINK_BASE_URL=$BASE_URL"
Environment="SOLANA_BLINK_RECIPIENT=$RECIPIENT"
Environment="SOLANA_RPC_URL=$RPC_URL"
Environment="SOLANA_BLINK_INTERSTITIAL_URL=$BLINK_URL"
EOF

systemctl --user daemon-reload
openclaw gateway restart

echo "Waiting for the OpenClaw gateway..."
for _ in $(seq 1 30); do
  if curl -fsS "$BASE_URL/api/actions/pay" >/dev/null; then
    break
  fi
  sleep 2
done

curl -fsS "$BASE_URL/actions.json" >/dev/null
curl -fsS "$BASE_URL/api/actions/pay" >/dev/null
openclaw health

echo
echo "Solana Blink installed:"
echo "$BLINK_URL"
echo
echo "Telegram test: message the bot 'Send me the Solana payment Blink'."
