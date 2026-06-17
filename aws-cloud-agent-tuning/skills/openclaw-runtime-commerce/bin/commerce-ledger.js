#!/usr/bin/env node
const { main } = require('../src/cli/commerce-ledger');

main(process.argv.slice(2)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});

