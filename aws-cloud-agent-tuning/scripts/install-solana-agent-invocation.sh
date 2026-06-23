#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  install-solana-agent-invocation.sh \
    --program-id PROGRAM_ID \
    --owner-keypair /path/to/owner.json \
    --agent-signer-keypair /path/to/agent-signer.json \
    --manifest-uri https://HOST/openclaw-agent-manifest.json \
    --manifest-hash SHA256_HEX \
    --openclaw-task-url http://127.0.0.1:3040/tasks \
    [--rpc-url https://api.devnet.solana.com] \
    [--agent-slug lobster] \
    [--price-lamports 1000000] \
    [--result-base-url https://HOST/results] \
    [--install-web]

Installs the Solana invocation worker for an AWS-hosted OpenClaw runtime.
The Anchor program must already be deployed to Solana.
EOF
}

PROGRAM_ID=""
OWNER_KEYPAIR=""
AGENT_SIGNER_KEYPAIR=""
MANIFEST_URI=""
MANIFEST_HASH=""
OPENCLAW_TASK_URL=""
RPC_URL="https://api.devnet.solana.com"
AGENT_SLUG="lobster"
PRICE_LAMPORTS="1000000"
RESULT_BASE_URL=""
INSTALL_WEB="0"

while (($#)); do
  case "$1" in
    --program-id) PROGRAM_ID="${2:-}"; shift 2 ;;
    --owner-keypair) OWNER_KEYPAIR="${2:-}"; shift 2 ;;
    --agent-signer-keypair) AGENT_SIGNER_KEYPAIR="${2:-}"; shift 2 ;;
    --manifest-uri) MANIFEST_URI="${2:-}"; shift 2 ;;
    --manifest-hash) MANIFEST_HASH="${2:-}"; shift 2 ;;
    --openclaw-task-url) OPENCLAW_TASK_URL="${2:-}"; shift 2 ;;
    --rpc-url) RPC_URL="${2:-}"; shift 2 ;;
    --agent-slug) AGENT_SLUG="${2:-}"; shift 2 ;;
    --price-lamports) PRICE_LAMPORTS="${2:-}"; shift 2 ;;
    --result-base-url) RESULT_BASE_URL="${2:-}"; shift 2 ;;
    --install-web) INSTALL_WEB="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

is_pubkey() {
  [[ "$1" =~ ^[1-9A-HJ-NP-Za-km-z]{32,44}$ ]]
}

if ! is_pubkey "$PROGRAM_ID"; then
  echo "--program-id does not look like a Solana public key" >&2
  exit 2
fi
if [[ ! -f "$OWNER_KEYPAIR" ]]; then
  echo "--owner-keypair must point to an existing Solana keypair JSON" >&2
  exit 2
fi
if [[ ! -f "$AGENT_SIGNER_KEYPAIR" ]]; then
  echo "--agent-signer-keypair must point to an existing Solana keypair JSON" >&2
  exit 2
fi
if [[ ! "$MANIFEST_URI" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "--manifest-uri must be HTTP(S)" >&2
  exit 2
fi
if [[ ! "$MANIFEST_HASH" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "--manifest-hash must be a 32-byte SHA-256 hex string" >&2
  exit 2
fi
if [[ ! "$OPENCLAW_TASK_URL" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "--openclaw-task-url must be HTTP(S)" >&2
  exit 2
fi
if [[ ! "$RPC_URL" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "--rpc-url must be HTTP(S)" >&2
  exit 2
fi

command -v node >/dev/null || { echo "node is not installed" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is not installed" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/solana-agent-invocation"
INSTALL_DIR="${OPENCLAW_SOLANA_INVOCATION_DIR:-$HOME/.openclaw/solana-agent-invocation}"
SYSTEMD_DIR="$HOME/.config/systemd/user"

mkdir -p "$INSTALL_DIR" "$SYSTEMD_DIR"
rsync -a --delete \
  --exclude node_modules \
  --exclude target \
  --exclude .anchor \
  --exclude .env \
  "$SOURCE/" "$INSTALL_DIR/"

cat > "$INSTALL_DIR/.env" <<EOF
SOLANA_RPC_URL=$RPC_URL
SOLANA_COMMITMENT=confirmed
PROGRAM_ID=$PROGRAM_ID
OWNER_KEYPAIR=$OWNER_KEYPAIR
AGENT_SIGNER_KEYPAIR=$AGENT_SIGNER_KEYPAIR
AGENT_SLUG=$AGENT_SLUG
AGENT_MANIFEST_URI=$MANIFEST_URI
AGENT_MANIFEST_HASH=$MANIFEST_HASH
AGENT_PRICE_LAMPORTS=$PRICE_LAMPORTS
OPENCLAW_TASK_URL=$OPENCLAW_TASK_URL
POLL_INTERVAL_MS=5000
RESULT_BASE_URL=$RESULT_BASE_URL
EOF

cd "$INSTALL_DIR"
npm ci --omit=dev --ignore-scripts

cat > "$SYSTEMD_DIR/openclaw-solana-invocation-worker.service" <<EOF
[Unit]
Description=OpenClaw Solana invocation worker
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$(command -v npx) tsx src/worker.ts
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now openclaw-solana-invocation-worker.service

if [[ "$INSTALL_WEB" == "1" ]]; then
  cat > "$SYSTEMD_DIR/openclaw-solana-invocation-web.service" <<EOF
[Unit]
Description=OpenClaw Solana invocation payload demo
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
Environment=PORT=8787
ExecStart=$(command -v npx) tsx src/web.ts
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable --now openclaw-solana-invocation-web.service
fi

echo
echo "Installed OpenClaw Solana invocation worker in:"
echo "$INSTALL_DIR"
echo
echo "Status:"
systemctl --user --no-pager status openclaw-solana-invocation-worker.service || true
if [[ "$INSTALL_WEB" == "1" ]]; then
  systemctl --user --no-pager status openclaw-solana-invocation-web.service || true
fi
echo
echo "Next:"
echo "  cd $INSTALL_DIR"
echo "  npm run register-agent"
echo "  journalctl --user -u openclaw-solana-invocation-worker.service -f"
