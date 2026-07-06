#!/usr/bin/env bash
set -euo pipefail

WORK="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
TOOLS="$WORK/tools"
STATE_DIR="$WORK/commerce"

mkdir -p "$TOOLS" "$STATE_DIR" "$HOME/bin" "$HOME/.config/systemd/user"

if ! command -v commerce-job >/dev/null 2>&1; then
  if [ -x "$WORK/skills/openclaw-runtime-commerce/bin/commerce-job.js" ]; then
    ln -sf "$WORK/skills/openclaw-runtime-commerce/bin/commerce-job.js" "$HOME/bin/commerce-job"
    export PATH="$HOME/bin:$PATH"
  else
    echo "commerce-job not found. Install openclaw-runtime-commerce first:" >&2
    echo "  bash aws-cloud-agent-tuning/scripts/install-openclaw-runtime-commerce.sh" >&2
    exit 1
  fi
fi

cat > "$TOOLS/telegram-commerce-adapter.js" <<'JS'
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORK = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME, '.openclaw/workspace');
const STATE_PATH = path.join(WORK, 'commerce/telegram-adapter-state.json');

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
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value) && /telegram|bot|token/i.test(key)) {
      return value;
    }
    if (value && typeof value === 'object') {
      const found = findTokenInObject(value, seen);
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
    if (!fs.existsSync(file)) continue;
    const token = findTokenInObject(readJson(file, {}));
    if (token) return token;
  }
  throw new Error('Telegram bot token not found. Set TELEGRAM_BOT_TOKEN in the service environment.');
}

async function telegram(method, params) {
  const token = findTelegramToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`${method} failed: ${JSON.stringify(body)}`);
  return body.result;
}

function usernameFromMessage(msg) {
  return msg.from?.username || [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join('_') || 'telegram_user';
}

function sourceUserFromMessage(msg) {
  return `telegram:${msg.from?.id || msg.chat.id}:${usernameFromMessage(msg)}`;
}

function runCommerceJob({ msg, amount, agent, dryRun }) {
  const args = [
    'run',
    '--source', 'telegram',
    '--source-user', sourceUserFromMessage(msg),
    '--offering', 'telegram_chat',
    '--agent', agent || 'main',
    '--amount', String(amount || '0.01'),
    '--token', 'USDC',
    '--input', msg.text
  ];
  if (dryRun) args.push('--dry-run');

  const out = execFileSync('commerce-job', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 4,
    env: { ...process.env, PATH: `${process.env.HOME}/bin:${process.env.PATH}` }
  });
  return JSON.parse(out);
}

function latestEvent(job, type) {
  return [...(job.events || [])].reverse().find((event) => event.type === type);
}

function replyForJob(job) {
  const delivered = latestEvent(job, 'delivered');
  const evaluated = latestEvent(job, 'release_recommended') || latestEvent(job, 'refund_recommended') || latestEvent(job, 'disputed');
  const artifact = String(delivered?.artifact || 'Done.');
  const verdict = evaluated?.verdict || 'unknown';
  const score = evaluated?.score === undefined ? 'n/a' : evaluated.score;
  return [
    artifact,
    '',
    `job: ${job.id}`,
    `status: ${job.status}`,
    `evaluator: ${evaluated?.evaluator || 'none'}`,
    `verdict: ${verdict}`,
    `score: ${score}`,
    'mode: ledger_only'
  ].join('\n').slice(0, 3900);
}

async function handleMessage(msg, opts) {
  if (!msg.text) return false;

  if (/^\s*hello\s+solana[!?.\s]*$/i.test(msg.text)) {
    const blinkUrl = process.env.SOLANA_HELLO_BLINK_URL;
    if (!blinkUrl) throw new Error('SOLANA_HELLO_BLINK_URL is not configured.');
    await telegram('sendMessage', {
      chat_id: msg.chat.id,
      text: [
        'Hello Solana Blink test:',
        blinkUrl,
        '',
        'This signs a memo-only transaction. No SOL or tokens are transferred; the normal Solana network fee applies.'
      ].join('\n')
    });
    return true;
  }

  if (msg.text.startsWith('/start')) {
    await telegram('sendMessage', {
      chat_id: msg.chat.id,
      text: 'OpenClaw Runtime Commerce adapter is online. Send a message to create a ledger-only contractor job.'
    });
    return true;
  }

  const job = runCommerceJob({ msg, amount: opts.amount, agent: opts.agent, dryRun: opts.dryRun });
  await telegram('sendMessage', { chat_id: msg.chat.id, text: replyForJob(job) });
  return true;
}

async function poll(opts) {
  const state = readJson(STATE_PATH, { offset: 0 });

  if (opts.dropPending) {
    const updates = await telegram('getUpdates', { offset: -1, timeout: 0, allowed_updates: ['message'] });
    if (updates.length) {
      state.offset = updates[updates.length - 1].update_id + 1;
      writeJson(STATE_PATH, state);
    }
  }

  while (true) {
    const updates = await telegram('getUpdates', {
      offset: state.offset || 0,
      timeout: opts.once ? 0 : 25,
      allowed_updates: ['message']
    });

    for (const update of updates) {
      state.offset = update.update_id + 1;
      writeJson(STATE_PATH, state);
      try {
        if (update.message) await handleMessage(update.message, opts);
      } catch (err) {
        console.error(`update ${update.update_id} failed: ${err.message}`);
        if (update.message?.chat?.id) {
          await telegram('sendMessage', {
            chat_id: update.message.chat.id,
            text: `Commerce adapter error: ${err.message}`.slice(0, 3900)
          }).catch(() => {});
        }
      }
    }

    if (opts.once) return;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: telegram-commerce-adapter --once|--poll [--agent main] [--amount 0.01] [--dry-run] [--drop-pending]');
    return;
  }
  await poll({
    once: !!args.once || !args.poll,
    agent: args.agent || 'main',
    amount: args.amount || '0.01',
    dryRun: !!args['dry-run'],
    dropPending: !!args['drop-pending']
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
JS

chmod +x "$TOOLS/telegram-commerce-adapter.js"
ln -sf "$TOOLS/telegram-commerce-adapter.js" "$HOME/bin/telegram-commerce-adapter"
SYSTEMD_SOLANA_HELLO_BLINK_URL="${SOLANA_HELLO_BLINK_URL:-}"
SYSTEMD_SOLANA_HELLO_BLINK_URL="${SYSTEMD_SOLANA_HELLO_BLINK_URL//%/%%}"

cat > "$HOME/.config/systemd/user/telegram-commerce-adapter.service" <<EOF
[Unit]
Description=Telegram inbound adapter for OpenClaw Runtime Commerce
After=network-online.target openclaw-gateway.service

[Service]
Type=simple
WorkingDirectory=$WORK
ExecStart=$TOOLS/telegram-commerce-adapter.js --poll --agent main --amount 0.01
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=$HOME/bin:/usr/local/bin:/usr/bin:/bin
Environment="SOLANA_HELLO_BLINK_URL=$SYSTEMD_SOLANA_HELLO_BLINK_URL"

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload

echo "Installed Telegram Runtime Commerce adapter."
echo "Test once: telegram-commerce-adapter --once --dry-run"
echo "Start service: systemctl --user enable --now telegram-commerce-adapter.service"
