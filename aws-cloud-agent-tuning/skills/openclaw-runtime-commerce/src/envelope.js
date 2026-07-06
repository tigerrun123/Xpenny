const crypto = require('node:crypto');
const { loadPolicy } = require('./policy');

function now() {
  return new Date().toISOString();
}

function parseInput(raw) {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { return JSON.parse(trimmed); } catch {}
  }
  return { message: raw };
}

function createEnvelope(args) {
  const policy = loadPolicy();
  const offering = String(args.offering || 'telegram_chat');
  const offeringPolicy = policy.offerings[offering] || {};
  const amount = Number(args.amount || offeringPolicy.defaultAmount || policy.defaultAmount || 0.01);
  const token = String(args.token || policy.defaultToken || 'USDC');
  const source = String(args.source || 'manual');
  const sourceUser = String(args['source-user'] || args.buyer || `${source}:unknown`);
  const agent = String(args.agent || offeringPolicy.defaultAgent || 'main');

  return {
    id: `job_${crypto.randomBytes(6).toString('hex')}`,
    source,
    sourceUser,
    offering,
    agent,
    amount,
    token,
    input: parseInput(args.input || args.message),
    provider: String(args.provider || 'Xtoken2000'),
    createdAt: now()
  };
}

module.exports = { createEnvelope, now };

