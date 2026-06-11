#!/usr/bin/env bash
set -euo pipefail

read -r -s -p "Bridge token: " XPENNY_BRIDGE_TOKEN
printf "\nInstalling Xpenny OpenClaw bridge...\n"

sudo install -d -m 0755 -o ubuntu -g ubuntu /home/ubuntu/xpenny-openclaw-bridge

printf 'XPENNY_BRIDGE_TOKEN=%s\nXPENNY_BRIDGE_PORT=8788\n' "$XPENNY_BRIDGE_TOKEN" |
  sudo tee /etc/xpenny-openclaw-bridge.env >/dev/null
sudo chmod 600 /etc/xpenny-openclaw-bridge.env
sudo chown root:root /etc/xpenny-openclaw-bridge.env

cat > /tmp/xpenny-openclaw-bridge-server.js <<'NODE'
const http = require('node:http');
const { execFile } = require('node:child_process');
const fs = require('node:fs');

const port = Number(process.env.XPENNY_BRIDGE_PORT || 8788);
const expectedToken = process.env.XPENNY_BRIDGE_TOKEN || '';
const maxBodyBytes = 64 * 1024;

function send(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBodyBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function authorized(req) {
  if (!expectedToken) {
    return false;
  }
  const header = req.headers.authorization || '';
  return header === `Bearer ${expectedToken}`;
}

function gatewayToken() {
  const cfg = JSON.parse(fs.readFileSync('/home/ubuntu/.openclaw/openclaw.json', 'utf8'));
  return cfg?.gateway?.auth?.token || '';
}

function cleanReply(stdout) {
  const text = String(stdout || '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('OpenClaw '))
    .filter((line) => !/^\d{2}:\d{2}:\d{2}\s+\[/.test(line))
    .filter((line) => !line.startsWith('[openclaw]'))
    .filter((line) => !line.includes('plugins.allow is empty'));

  return text.slice(-8).join('\n').trim();
}

function askOpenClaw(message) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      OPENCLAW_GATEWAY_TOKEN: gatewayToken(),
    };

    execFile(
      'openclaw',
      ['agent', '--agent', 'main', '--message', message],
      { env, timeout: 60000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          error.stderr = stderr;
          error.stdout = stdout;
          reject(error);
          return;
        }
        resolve(cleanReply(stdout) || cleanReply(stderr) || 'OpenClaw returned no reply text.');
      },
    );
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/xpenny-agent/health')) {
    send(res, 200, { ok: true, service: 'xpenny-openclaw-bridge' });
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (!authorized(req)) {
    send(res, 401, { ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw || '{}');
    const message = String(payload.message || '').trim();

    if (!message) {
      send(res, 400, { ok: false, error: 'Message is required' });
      return;
    }

    const reply = await askOpenClaw(message);
    send(res, 200, { ok: true, reply });
  } catch (error) {
    console.error('bridge request failed:', error.message);
    send(res, 500, { ok: false, error: error.message || 'Bridge request failed' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`xpenny-openclaw-bridge listening on 127.0.0.1:${port}`);
});
NODE

sudo install -m 0644 -o ubuntu -g ubuntu \
  /tmp/xpenny-openclaw-bridge-server.js \
  /home/ubuntu/xpenny-openclaw-bridge/server.js

cat > /tmp/xpenny-openclaw-bridge.service <<'UNIT'
[Unit]
Description=Xpenny OpenClaw bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/xpenny-openclaw-bridge
EnvironmentFile=/etc/xpenny-openclaw-bridge.env
ExecStart=/usr/bin/node /home/ubuntu/xpenny-openclaw-bridge/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT

sudo install -m 0644 \
  /tmp/xpenny-openclaw-bridge.service \
  /etc/systemd/system/xpenny-openclaw-bridge.service

cat > /tmp/xpenny-openclaw-bridge-apache.conf <<'APACHE'
ProxyPass /xpenny-agent http://127.0.0.1:8788/xpenny-agent
ProxyPassReverse /xpenny-agent http://127.0.0.1:8788/xpenny-agent
APACHE

sudo install -m 0644 \
  /tmp/xpenny-openclaw-bridge-apache.conf \
  /etc/apache2/conf-available/xpenny-openclaw-bridge.conf

sudo a2enmod proxy proxy_http >/dev/null
sudo a2enconf xpenny-openclaw-bridge >/dev/null
sudo apachectl configtest
sudo systemctl daemon-reload
sudo systemctl enable --now xpenny-openclaw-bridge.service
sudo systemctl reload apache2

sleep 2
sudo systemctl --no-pager --full status xpenny-openclaw-bridge.service | sed -n '1,18p'
curl -s http://127.0.0.1:8788/health
printf "\n"
curl -s \
  -H "Authorization: Bearer $XPENNY_BRIDGE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Reply exactly: AWS bridge connected."}' \
  http://127.0.0.1:8788/xpenny-agent
printf "\nBridge install complete.\n"

unset XPENNY_BRIDGE_TOKEN
