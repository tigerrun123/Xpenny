const path = require('node:path');

function workspacePath() {
  return process.env.OPENCLAW_WORKSPACE || path.join(process.env.HOME || '.', '.openclaw/workspace');
}

function commercePath(...parts) {
  return path.join(workspacePath(), 'commerce', ...parts);
}

module.exports = { workspacePath, commercePath };

