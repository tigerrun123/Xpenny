function latestDeliveredArtifact(job) {
  const delivered = [...job.events].reverse().find((event) => event.type === 'delivered');
  return String(delivered?.artifact || '');
}

function inputText(job) {
  const input = job.envelope?.input;
  if (typeof input === 'string') return input;
  if (input?.message) return String(input.message);
  return JSON.stringify(input || {});
}

function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .slice(0, 80);
}

function relevanceScore(input, artifact) {
  const inputTokens = new Set(tokens(input));
  const artifactTokens = new Set(tokens(artifact));
  if (inputTokens.size === 0) return 1;
  let overlap = 0;
  for (const token of inputTokens) {
    if (artifactTokens.has(token)) overlap++;
  }
  return overlap / inputTokens.size;
}

function check(name, passed, detail) {
  return { name, status: passed ? 'pass' : 'fail', detail };
}

function evaluateTelegramChat(job) {
  const artifact = latestDeliveredArtifact(job);
  const input = inputText(job);
  const errorPattern = /\b(error|failed|unauthorized|mismatch|exception|traceback|cannot|missing)\b/i;
  const empty = artifact.trim().length === 0;
  const hasError = errorPattern.test(artifact);
  const score = relevanceScore(input, artifact);
  const enoughForChat = artifact.trim().length >= 2;

  const checks = [
    check('non_empty_reply', !empty, empty ? 'No Telegram reply artifact was recorded.' : 'Reply artifact exists.'),
    check('no_error_marker', !hasError, hasError ? 'Reply contains an error marker.' : 'No obvious error marker found.'),
    check('basic_relevance', score >= 0.12 || enoughForChat, `Token overlap score: ${score.toFixed(2)}.`)
  ];

  if (empty) {
    return {
      evaluator: 'telegram-chat-v1',
      verdict: 'fail',
      decision: 'refund_recommended',
      score: 0,
      reason: 'Telegram chat produced no reply.',
      checks
    };
  }

  if (hasError) {
    return {
      evaluator: 'telegram-chat-v1',
      verdict: 'needs_review',
      decision: 'needs_review',
      score: 0.4,
      reason: 'Telegram chat reply contains error markers and should be reviewed.',
      checks
    };
  }

  return {
    evaluator: 'telegram-chat-v1',
    verdict: 'pass',
    decision: 'release_recommended',
    score: Math.max(0.7, Math.min(1, 0.7 + score)),
    reason: 'Telegram chat reply is present and passes the basic completion checks.',
    checks
  };
}

module.exports = { evaluateTelegramChat };
