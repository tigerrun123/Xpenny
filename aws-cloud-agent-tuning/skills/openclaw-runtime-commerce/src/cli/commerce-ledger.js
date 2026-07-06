const { parseArgs } = require('../args');
const { ledgerPath, listJobs, showJob } = require('../ledger');
const { policyPath, ensurePolicy } = require('../policy');

function help() {
  return `Usage:
  commerce-ledger help
  commerce-ledger paths
  commerce-ledger policy
  commerce-ledger list
  commerce-ledger show <job_id>`;
}

async function main(argv) {
  const args = parseArgs(argv);
  const [cmd, id] = args._;
  let result;
  if (!cmd || cmd === 'help') result = help();
  else if (cmd === 'paths') result = { ledgerPath: ledgerPath(), policyPath: policyPath() };
  else if (cmd === 'policy') result = ensurePolicy();
  else if (cmd === 'list') result = listJobs();
  else if (cmd === 'show') result = showJob(id);
  else throw new Error(`Unknown commerce-ledger command: ${cmd}`);

  if (typeof result === 'string') console.log(result);
  else console.log(JSON.stringify(result, null, 2));
}

module.exports = { main };

