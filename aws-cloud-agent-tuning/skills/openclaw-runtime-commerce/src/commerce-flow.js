const { ensurePolicy, validateEnvelope } = require('./policy');
const { createEnvelope } = require('./envelope');
const { createJob, transitionAndSave, showJob } = require('./ledger');
const { runWorkAgent } = require('./router');
const { evaluateJob } = require('./evaluator');

function runCommerceJob(args) {
  const policy = ensurePolicy();
  const envelope = createEnvelope(args);
  const decision = validateEnvelope(envelope, policy);
  if (!decision.ok) throw new Error(decision.reason);

  createJob(envelope, decision);
  transitionAndSave(envelope.id, 'awaiting_funds', { note: 'Ledger-only simulated funding requested.' });
  transitionAndSave(envelope.id, 'funded', { tx: `simulated_${Date.now()}`, note: 'Ledger-only funding marker. No real funds moved.' });
  transitionAndSave(envelope.id, 'locked', { note: 'Ledger-only lock marker.' });
  transitionAndSave(envelope.id, 'work_started', { note: 'Work agent started.' });

  const artifact = decision.review
    ? `Manual review required before executing ${envelope.offering}.`
    : runWorkAgent(envelope, { dryRun: !!args['dry-run'] });

  transitionAndSave(envelope.id, 'delivered', { artifact });
  const evaluation = evaluateJob(showJob(envelope.id));

  if (evaluation.decision === 'release_recommended') {
    transitionAndSave(envelope.id, 'release_recommended', evaluation);
    transitionAndSave(envelope.id, 'released', { approvedBy: 'commerce-skill-ledger-only', note: 'Ledger-only release. Wallet executor not enabled.' });
  } else if (evaluation.decision === 'refund_recommended') {
    transitionAndSave(envelope.id, 'refund_recommended', evaluation);
  } else {
    transitionAndSave(envelope.id, 'disputed', evaluation);
  }

  return showJob(envelope.id);
}

module.exports = { runCommerceJob };

