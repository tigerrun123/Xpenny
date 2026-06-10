#!/usr/bin/env bash
set -euo pipefail

echo "== system =="
uname -a

echo
echo "== node =="
node --version || true
npm --version || true

echo
echo "== openclaw =="
command -v openclaw || true
openclaw --version || true

echo
echo "== gateway status =="
openclaw gateway status || true

echo
echo "== doctor =="
openclaw doctor || true

echo
echo "== systemd user services =="
systemctl --user status openclaw 2>/dev/null || true
systemctl --user list-units 2>/dev/null | grep -i openclaw || true

echo
echo "== listening ports =="
ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null || true

