const { commercePath } = require('./paths');
const { readJson, writeJson } = require('./json-store');
const { now } = require('./envelope');

const transitions = {
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

function ledgerPath() {
  return commercePath('ledger.json');
}

function loadLedger() {
  const ledger = readJson(ledgerPath(), { version: 1, jobs: [] });
  ledger.jobs ||= [];
  return ledger;
}

function saveLedger(ledger) {
  writeJson(ledgerPath(), ledger);
}

function event(type, data = {}) {
  return { type, at: now(), ...data };
}

function createJob(envelope, policyDecision) {
  const ledger = loadLedger();
  const job = {
    id: envelope.id,
    status: 'created',
    envelope,
    amount: envelope.amount,
    token: envelope.token,
    source: envelope.source,
    sourceUser: envelope.sourceUser,
    offering: envelope.offering,
    agent: envelope.agent,
    mode: 'ledger_only',
    realWalletMovement: false,
    policyDecision,
    createdAt: now(),
    updatedAt: now(),
    events: [event('created', { note: 'Commerce job created. Ledger-only mode.' })]
  };
  ledger.jobs.push(job);
  saveLedger(ledger);
  return job;
}

function findJob(ledger, id) {
  const job = ledger.jobs.find((candidate) => candidate.id === id);
  if (!job) throw new Error(`Commerce job not found: ${id}`);
  return job;
}

function transition(job, next, data = {}) {
  const allowed = transitions[job.status] || [];
  if (!allowed.includes(next)) throw new Error(`Invalid transition ${job.status} -> ${next}`);
  job.status = next;
  job.updatedAt = now();
  job.events.push(event(next, data));
}

function transitionAndSave(id, status, data = {}) {
  const ledger = loadLedger();
  const job = findJob(ledger, id);
  transition(job, status, data);
  saveLedger(ledger);
  return job;
}

function listJobs() {
  return loadLedger().jobs.map((job) => ({
    id: job.id,
    status: job.status,
    source: job.source,
    sourceUser: job.sourceUser,
    offering: job.offering,
    agent: job.agent,
    amount: job.amount,
    token: job.token,
    updatedAt: job.updatedAt
  }));
}

function showJob(id) {
  return findJob(loadLedger(), id);
}

module.exports = { ledgerPath, loadLedger, saveLedger, createJob, transitionAndSave, listJobs, showJob };

