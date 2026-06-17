const { parseArgs } = require('../args');
const { evaluateJob } = require('../evaluator');
const { showJob } = require('../ledger');

function help() {
  return `Usage:
  commerce-evaluate --job <job_id>`;
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

