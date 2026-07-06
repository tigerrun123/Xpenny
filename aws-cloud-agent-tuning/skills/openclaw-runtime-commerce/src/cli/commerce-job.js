const { parseArgs } = require('../args');
const { runCommerceJob } = require('../commerce-flow');
const { listJobs, showJob } = require('../ledger');

function help() {
  return `Usage:
  commerce-job help
  commerce-job run --source telegram --source-user telegram:123:alice --offering telegram_chat --agent main --amount 0.01 --token USDC --input "hello" [--dry-run]
  commerce-job list
  commerce-job show <job_id>`;
}

async function main(argv) {
  const args = parseArgs(argv);
  const [cmd, id] = args._;
  let result;
  if (!cmd || cmd === 'help') result = help();
  else if (cmd === 'run') result = runCommerceJob(args);
  else if (cmd === 'list') result = listJobs();
  else if (cmd === 'show') result = showJob(id);
  else throw new Error(`Unknown commerce-job command: ${cmd}`);

  if (typeof result === 'string') console.log(result);
  else console.log(JSON.stringify(result, null, 2));
}

module.exports = { main };

