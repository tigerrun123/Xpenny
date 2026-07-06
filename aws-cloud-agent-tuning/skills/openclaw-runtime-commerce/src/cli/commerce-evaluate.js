const { parseArgs } = require('../args');
const { evaluateJob } = require('../evaluator');
const { showJob } = require('../ledger');

function help() {
  return `Usage:
  commerce-evaluate --job <job_id>

Evaluates the delivered artifact for a commerce job.
For telegram_chat jobs, uses telegram-chat-v1 checks:
  - non_empty_reply
  - no_error_marker
  - basic_relevance`;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.job) {
    console.log(help());
    return;
  }
  const job = showJob(args.job);
  console.log(JSON.stringify(evaluateJob(job), null, 2));
}

module.exports = { main };
