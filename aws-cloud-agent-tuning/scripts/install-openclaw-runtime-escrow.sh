#!/usr/bin/env bash
set -euo pipefail

WORK="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
TOOLS="$WORK/tools"
ESCROW_DIR="$WORK/escrow"

mkdir -p "$TOOLS" "$ESCROW_DIR" "$HOME/bin" "$WORK/.openclaw/skills/openclaw-runtime-escrow"

cat > "$ESCROW_DIR/policy.json" <<'JSON'
{
  "version": 1,
  "mode": "ledger_only",
  "realWalletMovement": false,
  "requireHumanApprovalForRelease": true,
  "maxSimulatedJobValueUSDC": 100,
  "allowedTokens": ["USDC"],
  "allowedProviders": ["Xtoken2000"]
}
JSON

if [ ! -f "$ESCROW_DIR/ledger.json" ]; then
  cat > "$ESCROW_DIR/ledger.json" <<'JSON'
{
  "version": 1,
  "jobs": []
}
JSON
fi

cat > "$TOOLS/escrow-ledger.js" <<'JS'
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const WORK = process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME, '.openclaw/workspace');
const ESCROW_DIR = path.join(WORK, 'escrow');
const LEDGER_PATH = path.join(ESCROW_DIR, 'ledger.json');
const POLICY_PATH = path.join(ESCROW_DIR, 'policy.json');

const statusOrder = {
  created: ['awaiting_funds', 'cancelled', 'disputed'],
  awaiting_funds: ['funded', 'cancelled', 'disputed'],
  funded: ['locked', 'refund_recommended', 'refunded', 'disputed'],
  locked: ['work_started', 'refund_recommended', 'refunded', 'disputed'],
  work_started: ['delivered', 'refund_recommended', 'disputed'],
  delivered: ['release_recommended', 'refund_recommended', 'disputed'],
  release_recommended: ['released', 'disputed'],
  refund_recommended: ['refunded', 'disputed'],
  released: [],
  refunded: [],
  cancelled: [],
  disputed: []
};

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

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function now() {
  return new Date().toISOString();
}

function loadLedger() {
  const ledger = readJson(LEDGER_PATH, { version: 1, jobs: [] });
  ledger.jobs ||= [];
  return ledger;
}

function saveLedger(ledger) {
  writeJson(LEDGER_PATH, ledger);
}

function loadPolicy() {
  return readJson(POLICY_PATH, {
    mode: 'ledger_only',
    realWalletMovement: false,
    requireHumanApprovalForRelease: true,
    maxSimulatedJobValueUSDC: 100,
    allowedTokens: ['USDC'],
    allowedProviders: ['Xtoken2000']
  });
}

function event(type, data = {}) {
  return { type, at: now(), ...data };
}

function findJob(ledger, id) {
  const job = ledger.jobs.find((j) => j.id === id);
  if (!job) throw new Error(`Escrow job not found: ${id}`);
  return job;
}

function transition(job, next, data = {}) {
  const allowed = statusOrder[job.status] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid transition ${job.status} -> ${next}`);
  }
  job.status = next;
  job.updatedAt = now();
  job.events.push(event(next, data));
}

function validateCreate(args, policy) {
  const amount = Number(args.amount || 0);
  const token = String(args.token || 'USDC');
  const provider = String(args.provider || '');
  if (!args.buyer) throw new Error('Missing --buyer');
  if (!provider) throw new Error('Missing --provider');
  if (!args.offering) throw new Error('Missing --offering');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid --amount');
  if (policy.allowedTokens && !policy.allowedTokens.includes(token)) throw new Error(`Token not allowed: ${token}`);
  if (policy.allowedProviders && !policy.allowedProviders.includes(provider)) throw new Error(`Provider not allowed: ${provider}`);
  if (policy.maxSimulatedJobValueUSDC && token === 'USDC' && amount > Number(policy.maxSimulatedJobValueUSDC)) {
    throw new Error(`Amount exceeds maxSimulatedJobValueUSDC: ${amount}`);
  }
  return { amount, token, provider };
}

function create(args) {
  const policy = loadPolicy();
  const { amount, token, provider } = validateCreate(args, policy);
  const ledger = loadLedger();
  const id = `escrow_${crypto.randomBytes(6).toString('hex')}`;
  const job = {
    id,
    status: 'created',
    buyerWallet: String(args.buyer),
    provider,
    offering: String(args.offering),
    amount,
    token,
    terms: String(args.terms || ''),
    mode: policy.mode || 'ledger_only',
    realWalletMovement: !!policy.realWalletMovement,
    createdAt: now(),
    updatedAt: now(),
    events: [event('created', { note: 'Ledger-only escrow job created. No funds moved.' })]
  };
  ledger.jobs.push(job);
  saveLedger(ledger);
  transitionAndSave(id, 'awaiting_funds', { note: 'Awaiting simulated funding marker.' });
  return show(id);
}

function transitionAndSave(id, status, data = {}) {
  const ledger = loadLedger();
  const job = findJob(ledger, id);
  transition(job, status, data);
  saveLedger(ledger);
  return job;
}

function show(id) {
  return findJob(loadLedger(), id);
}

function list() {
  return loadLedger().jobs.map((job) => ({
    id: job.id,
    status: job.status,
    buyerWallet: job.buyerWallet,
    provider: job.provider,
    offering: job.offering,
    amount: job.amount,
    token: job.token,
    updatedAt: job.updatedAt
  }));
}

function help() {
  return `Usage:
  escrow-ledger help
  escrow-ledger policy
  escrow-ledger create --buyer 0xBuyer --provider Xtoken2000 --offering market_observer --amount 0.01 --token USDC --terms "..."
  escrow-ledger list
  escrow-ledger show <escrow_id>
  escrow-ledger fund <escrow_id> --tx simulated_tx
  escrow-ledger lock <escrow_id>
  escrow-ledger start <escrow_id>
  escrow-ledger deliver <escrow_id> --artifact "..."
  escrow-ledger recommend-release <escrow_id> --reason "..."
  escrow-ledger recommend-refund <escrow_id> --reason "..."
  escrow-ledger release <escrow_id> --approved-by human
  escrow-ledger refund <escrow_id> --approved-by human
  escrow-ledger dispute <escrow_id> --reason "..."`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, id] = args._;
  let result;
  if (!cmd || cmd === 'help') result = help();
  else if (cmd === 'policy') result = loadPolicy();
  else if (cmd === 'list') result = list();
  else if (cmd === 'show') result = show(id);
  else if (cmd === 'create') result = create(args);
  else if (cmd === 'fund') result = transitionAndSave(id, 'funded', { tx: args.tx || 'simulated_tx', note: 'Ledger-only funding marker. No funds moved.' });
  else if (cmd === 'lock') result = transitionAndSave(id, 'locked', { note: 'Ledger-only lock marker.' });
  else if (cmd === 'start') result = transitionAndSave(id, 'work_started', { note: 'Work started.' });
  else if (cmd === 'deliver') result = transitionAndSave(id, 'delivered', { artifact: args.artifact || '', note: 'Deliverable recorded.' });
  else if (cmd === 'recommend-release') result = transitionAndSave(id, 'release_recommended', { reason: args.reason || '', note: 'Release recommended.' });
  else if (cmd === 'recommend-refund') result = transitionAndSave(id, 'refund_recommended', { reason: args.reason || '', note: 'Refund recommended.' });
  else if (cmd === 'release') result = transitionAndSave(id, 'released', { approvedBy: args['approved-by'] || 'human', note: 'Ledger-only release. Wallet executor not enabled.' });
  else if (cmd === 'refund') result = transitionAndSave(id, 'refunded', { approvedBy: args['approved-by'] || 'human', note: 'Ledger-only refund. Wallet executor not enabled.' });
  else if (cmd === 'dispute') result = transitionAndSave(id, 'disputed', { reason: args.reason || '', note: 'Dispute marker recorded.' });
  else throw new Error(`Unknown command: ${cmd}`);

  if (typeof result === 'string') console.log(result);
  else console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
JS

chmod +x "$TOOLS/escrow-ledger.js"
ln -sf "$TOOLS/escrow-ledger.js" "$HOME/bin/escrow-ledger"

cat > "$WORK/.openclaw/skills/openclaw-runtime-escrow/SKILL.md" <<'MD'
# OpenClaw Runtime Escrow

Ledger-only runtime escrow layer for OpenClaw jobs.

This skill does not move real funds. It records escrow lifecycle events in:

```text
$OPENCLAW_WORKSPACE/escrow/ledger.json
```

Use `escrow-ledger help` for available commands.

Wallet executor and evaluator agents are future phases.
MD

echo "Installed ledger-only OpenClaw runtime escrow."
echo "Ledger: $ESCROW_DIR/ledger.json"
echo "Policy: $ESCROW_DIR/policy.json"
echo "CLI: escrow-ledger help"
