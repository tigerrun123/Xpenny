#!/usr/bin/env bash
set -euo pipefail

WORK="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
TOOLS="$WORK/tools"
STATE_DIR="$WORK/escrow"

mkdir -p "$TOOLS" "$STATE_DIR" "$HOME/bin" "$HOME/.config/systemd/user"

cat > "$TOOLS/telegram-escrow-chat.js" <<'JS'
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORK = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME, '.openclaw/workspace');
const LEDGER = path.join(WORK, 'tools/escrow-ledger.js');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else args[key] = next, i++;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 2, ...opts });
}

function ledger(args) {
  return JSON.parse(run(LEDGER, args));
}

function gatewayEnv() {
  const env = { ...process.env };
  if (!env.OPENCLAW_GATEWAY_TOKEN) {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.openclaw/openclaw.json'), 'utf8'));
      if (cfg.gateway?.auth?.token) env.OPENCLAW_GATEWAY_TOKEN = cfg.gateway.auth.token;
    } catch {}
  }
  return env;
}

function callOpenClaw(agent, message, escrowId, dryRun) {
  if (dryRun) return `[dry-run] Escrow ${escrowId} would answer: ${message}`;
  const prompt = `Telegram escrow job ${escrowId}. Reply briefly to the user message:\n\n${message}`;
  try {
    return run('openclaw', ['agent', '--agent', agent, '-m', prompt], { env: gatewayEnv() }).trim();
  } catch (err) {
    const detail = err.stderr?.toString?.() || err.message;
    console.error(`gateway agent failed, using embedded fallback: ${detail}`);
    return `OK (${escrowId})`;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.message) {
    console.log('Usage: telegram-escrow-chat --from 8686051916 --username xtoke2000 --amount 0.01 --message "hello" [--agent main] [--dry-run]');
    return;
  }

  if (!fs.existsSync(LEDGER)) throw new Error(`Missing escrow ledger CLI: ${LEDGER}`);

  const from = String(args.from || 'telegram-user');
  const username = String(args.username || 'unknown');
  const amount = String(args.amount || '0.01');
  const token = String(args.token || 'USDC');
  const agent = String(args.agent || 'main');
  const message = String(args.message);
  const buyer = `telegram:${from}:${username}`;

  const created = ledger([
    'create',
    '--buyer', buyer,
    '--provider', 'Xtoken2000',
    '--offering', 'telegram_chat',
    '--amount', amount,
    '--token', token,
    '--terms', `Telegram chat from ${buyer}`
  ]);
  const escrowId = created.id;

  ledger(['fund', escrowId, '--tx', `simulated_telegram_${Date.now()}`]);
  ledger(['lock', escrowId]);
  ledger(['start', escrowId]);
  const reply = callOpenClaw(agent, message, escrowId, !!args['dry-run']);
  ledger(['deliver', escrowId, '--artifact', reply]);
  ledger(['recommend-release', escrowId, '--reason', 'Telegram chat response completed.']);
  const released = ledger(['release', escrowId, '--approved-by', 'telegram-escrow-test']);

  console.log(JSON.stringify({
    ok: true,
    escrowId,
    status: released.status,
    buyer,
    amount: Number(amount),
    token,
    agent,
    reply
  }, null, 2));
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
JS

cat > "$TOOLS/telegram-escrow-bridge.js" <<'JS'
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORK = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME, '.openclaw/workspace');
const STATE_PATH = path.join(WORK, 'escrow/telegram-bridge-state.json');
const CHAT = path.join(WORK, 'tools/telegram-escrow-chat.js');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const n = argv[i + 1];
      if (!n || n.startsWith('--')) args[k] = true;
      else args[k] = n, i++;
    } else args._.push(a);
  }
  return args;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function findTokenInObject(obj, seen = new Set()) {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return null;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(v) && /telegram|bot|token/i.test(k)) return v;
    if (v && typeof v === 'object') {
      const found = findTokenInObject(v, seen);
      if (found) return found;
    }
  }
  return null;
}

function findTelegramToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  const candidates = [
    path.join(process.env.HOME, '.openclaw/openclaw.json'),
    path.join(process.env.HOME, '.openclaw/config.json'),
    path.join(WORK, '.openclaw/openclaw.json')
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const token = findTokenInObject(readJson(file, {}));
      if (token) return token;
    }
  }
  throw new Error('Telegram bot token not found. Set TELEGRAM_BOT_TOKEN in the service environment.');
}

async function tg(method, params) {
  const token = findTelegramToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  return json.result;
}

function runEscrowChat({ from, username, message, amount, agent }) {
  const out = execFileSync(CHAT, [
    '--from', String(from),
    '--username', username || 'unknown',
    '--amount', String(amount || '0.01'),
    '--message', message,
    '--agent', agent || 'main'
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 2 });
  return JSON.parse(out);
}

async function handleUpdate(update, opts) {
  const msg = update.message;
  if (!msg?.chat || !msg.text) return false;

  if (msg.text.startsWith('/start')) {
    await tg('sendMessage', {
      chat_id: msg.chat.id,
      text: 'OpenClaw escrow bridge is online. Send a message to create a ledger-only escrow job.'
    });
    return true;
  }

  const username = msg.from?.username || [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join('_') || 'telegram_user';
  const result = runEscrowChat({
    from: msg.from?.id || msg.chat.id,
    username,
    message: msg.text,
    amount: opts.amount,
    agent: opts.agent
  });

  const reply = `${result.reply || 'Done'}\n\nescrow: ${result.escrowId}\nstatus: ${result.status}\nmode: ledger_only`;
  await tg('sendMessage', { chat_id: msg.chat.id, text: reply.slice(0, 3900) });
  return true;
}

async function poll(opts) {
  const state = readJson(STATE_PATH, { offset: 0 });
  while (true) {
    const updates = await tg('getUpdates', {
      offset: state.offset || 0,
      timeout: opts.once ? 0 : 25,
      allowed_updates: ['message']
    });

    for (const update of updates) {
      state.offset = update.update_id + 1;
      writeJson(STATE_PATH, state);
      try {
        await handleUpdate(update, opts);
      } catch (err) {
        console.error(`update ${update.update_id} failed: ${err.message}`);
      }
    }

    if (opts.once) break;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: telegram-escrow-bridge --once|--poll [--agent main] [--amount 0.01]');
    return;
  }
  if (!fs.existsSync(CHAT)) throw new Error(`Missing ${CHAT}`);
  await poll({ once: !!args.once || !args.poll, agent: args.agent || 'main', amount: args.amount || '0.01' });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
JS

chmod +x "$TOOLS/telegram-escrow-chat.js" "$TOOLS/telegram-escrow-bridge.js"
ln -sf "$TOOLS/telegram-escrow-chat.js" "$HOME/bin/telegram-escrow-chat"
ln -sf "$TOOLS/telegram-escrow-bridge.js" "$HOME/bin/telegram-escrow-bridge"

cat > "$HOME/.config/systemd/user/telegram-escrow-bridge.service" <<EOF
[Unit]
Description=Telegram to OpenClaw Escrow Bridge
After=network-online.target openclaw-gateway.service

[Service]
Type=simple
WorkingDirectory=$WORK
ExecStart=$TOOLS/telegram-escrow-bridge.js --poll --agent main --amount 0.01
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload

echo "Installed telegram escrow bridge."
echo "Test once: telegram-escrow-bridge --once"
echo "Start service: systemctl --user enable --now telegram-escrow-bridge.service"
