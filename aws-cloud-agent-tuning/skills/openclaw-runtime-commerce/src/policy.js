const { commercePath } = require('./paths');
const { readJson, writeJson } = require('./json-store');

const defaultPolicy = {
  version: 1,
  mode: 'ledger_only',
  realWalletMovement: false,
  defaultAmount: 0.01,
  defaultToken: 'USDC',
  maxSimulatedJobValueUSDC: 100,
  allowedTokens: ['USDC'],
  allowedProviders: ['Xtoken2000'],
  offerings: {
    telegram_chat: {
      mode: 'public',
      defaultAgent: 'main',
      minAmount: 0.01,
      evaluator: 'basic-completion'
    },
    market_observer: {
      mode: 'public',
      defaultAgent: 'market-observer',
      minAmount: 0.01,
      evaluator: 'basic-completion'
    },
    risk_evaluation: {
      mode: 'review',
      defaultAgent: 'risk-evaluator',
      minAmount: 0.05,
      evaluator: 'risk-report-completion'
    }
  }
};

function policyPath() {
  return commercePath('policy.json');
}

function loadPolicy() {
  const policy = readJson(policyPath(), defaultPolicy);
  return { ...defaultPolicy, ...policy, offerings: { ...defaultPolicy.offerings, ...(policy.offerings || {}) } };
}

function ensurePolicy() {
  const policy = loadPolicy();
  writeJson(policyPath(), policy);
  return policy;
}

function validateEnvelope(envelope, policy = loadPolicy()) {
  const offeringPolicy = policy.offerings[envelope.offering];
  if (!offeringPolicy) return { ok: false, reason: `Unknown offering: ${envelope.offering}` };
  if (policy.allowedTokens && !policy.allowedTokens.includes(envelope.token)) {
    return { ok: false, reason: `Token not allowed: ${envelope.token}` };
  }
  if (policy.maxSimulatedJobValueUSDC && envelope.token === 'USDC' && envelope.amount > Number(policy.maxSimulatedJobValueUSDC)) {
    return { ok: false, reason: `Amount exceeds maxSimulatedJobValueUSDC: ${envelope.amount}` };
  }
  if (offeringPolicy.minAmount && envelope.amount < Number(offeringPolicy.minAmount)) {
    return { ok: false, reason: `Amount below minimum for ${envelope.offering}: ${envelope.amount}` };
  }
  if (offeringPolicy.mode === 'blocked') return { ok: false, reason: `Offering blocked: ${envelope.offering}` };
  if (offeringPolicy.mode === 'review') return { ok: true, review: true, reason: `Offering requires review: ${envelope.offering}` };
  return { ok: true, review: false, reason: 'Policy accepted.' };
}

module.exports = { defaultPolicy, policyPath, loadPolicy, ensurePolicy, validateEnvelope };

