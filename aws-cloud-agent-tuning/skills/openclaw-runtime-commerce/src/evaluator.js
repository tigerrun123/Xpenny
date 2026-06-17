const { showJob, transitionAndSave } = require('./ledger');

function evaluateJob(job) {
  const delivered = [...job.events].reverse().find((event) => event.type === 'delivered');
  const artifact = String(delivered?.artifact || '');
  if (!artifact.trim()) {
    return {
      decision: 'refund_recommended',
      score: 0,
      reason: 'No deliverable artifact recorded.'
    };
  }
  if (/failed|error|unauthorized|mismatch/i.test(artifact)) {
    return {
      decision: 'needs_review',
      score: 0.4,
      reason: 'Deliverable contains failure markers and needs review.'
    };
  }
  return {
    decision: 'release_recommended',
    score: 1,
    reason: 'Basic completion evaluator accepted the deliverable.'
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

