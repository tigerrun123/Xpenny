const { showJob, transitionAndSave } = require('./ledger');
const { evaluateTelegramChat } = require('./evaluators/telegram-chat');

function latestDeliveredArtifact(job) {
  const delivered = [...job.events].reverse().find((event) => event.type === 'delivered');
  return String(delivered?.artifact || '');
}

function evaluateJob(job) {
  if (job.offering === 'telegram_chat') {
    return evaluateTelegramChat(job);
  }

  const artifact = latestDeliveredArtifact(job);
  if (!artifact.trim()) {
    return {
      evaluator: 'basic-completion-v1',
      verdict: 'fail',
      decision: 'refund_recommended',
      score: 0,
      reason: 'No deliverable artifact recorded.',
      checks: [
        { name: 'non_empty_artifact', status: 'fail', detail: 'No deliverable artifact was recorded.' }
      ]
    };
  }
  if (/failed|error|unauthorized|mismatch/i.test(artifact)) {
    return {
      evaluator: 'basic-completion-v1',
      verdict: 'needs_review',
      decision: 'needs_review',
      score: 0.4,
      reason: 'Deliverable contains failure markers and needs review.',
      checks: [
        { name: 'no_error_marker', status: 'fail', detail: 'Artifact contains an error marker.' }
      ]
    };
  }
  return {
    evaluator: 'basic-completion-v1',
    verdict: 'pass',
    decision: 'release_recommended',
    score: 1,
    reason: 'Basic completion evaluator accepted the deliverable.',
    checks: [
      { name: 'non_empty_artifact', status: 'pass', detail: 'Deliverable artifact exists.' },
      { name: 'no_error_marker', status: 'pass', detail: 'No obvious error marker found.' }
    ]
  };
}

function evaluateAndTransition(id) {
  const job = showJob(id);
  const evaluation = evaluateJob(job);
  if (evaluation.decision === 'release_recommended') {
    return transitionAndSave(id, 'release_recommended', evaluation);
  }
  if (evaluation.decision === 'refund_recommended') {
    return transitionAndSave(id, 'refund_recommended', evaluation);
  }
  const updated = transitionAndSave(id, 'disputed', evaluation);
  return updated;
}

module.exports = { evaluateJob, evaluateAndTransition };
