const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function gatewayEnv() {
  const env = { ...process.env };
  if (!env.OPENCLAW_GATEWAY_TOKEN) {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.openclaw/openclaw.json'), 'utf8'));
      if (cfg.gateway?.auth?.token) env.OPENCLAW_GATEWAY_TOKEN = cfg.gateway.auth.token;
    } catch {}
  }
  return env;
}

function inputSummary(input) {
  if (typeof input === 'string') return input;
  if (input?.message) return String(input.message);
  return JSON.stringify(input);
}

function runWorkAgent(envelope, opts = {}) {
  const prompt = [
    `Commerce job ${envelope.id}`,
    `Source: ${envelope.source}`,
    `Offering: ${envelope.offering}`,
    `Reply to the job input concisely.`,
    '',
    inputSummary(envelope.input)
  ].join('\n');

  if (opts.dryRun) {
    return `[dry-run] ${envelope.agent} would handle ${envelope.offering}: ${inputSummary(envelope.input)}`;
  }

  try {
    return execFileSync('openclaw', ['agent', '--agent', envelope.agent, '-m', prompt], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 2,
      env: gatewayEnv()
    }).trim();
  } catch (err) {
    const detail = err.stderr?.toString?.() || err.message;
    return `Fallback response for ${envelope.id}. OpenClaw agent call failed: ${detail.split('\n')[0]}`;
  }
}

module.exports = { runWorkAgent, inputSummary };

