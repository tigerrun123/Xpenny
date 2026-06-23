# AWS Cloud Agent Tuning

This project collects the code, notes, configs, prompts, logs, and evaluations for tuning the AWS-hosted cloud agent.

## Structure

- `notes/` - working notes, decisions, and investigation logs
- `prompts/` - system prompts, agent instructions, and prompt versions
- `evals/` - test cases and evaluation results
- `configs/` - deployment and runtime configuration references
- `scripts/` - local helper scripts for testing and analysis
- `skills/` - OpenClaw skill prototypes and reusable runtime components

## Current Goal

Use Codex to inspect, tune, test, and improve the AWS-hosted agent/service.

## Current Deployment Target

AWS Lightsail with OpenClaw already installed.

OpenClaw channels currently configured or investigated:

- Telegram chatbot: `notes/openclaw-lightsail-telegram-config.md`
- WhatsApp channel: `notes/whatsapp-channel-setup.md`
- Google Meet plugin: `notes/google-meet-plugin-setup.md`
- Farcaster Mini App on Netlify: `notes/farcaster-miniapp-setup.md`

Current commerce/escrow prototype:

- `skills/openclaw-runtime-commerce/`: channel-agnostic ledger-only commerce lifecycle skill.
- `scripts/install-openclaw-runtime-commerce.sh`: installer for the OpenClaw workspace.

Solana Blinks:

- `plugins/solana-blinks/`: OpenClaw HTTP plugin for a wallet-signed SOL payment Action.
- `skills/solana-blinks/`: Telegram-facing agent instructions and safety boundaries.
- `scripts/install-solana-blinks.sh`: Lightsail installer; requires only a public recipient address and the instance HTTPS URL.

Solana Agent Invocation MVP:

- `solana-agent-invocation/`: Anchor program, TypeScript worker, CLI clients, and a small payload demo for turning the AWS OpenClaw instance into a Solana-discoverable invocation endpoint.
