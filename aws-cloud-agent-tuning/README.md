# AWS Cloud Agent Tuning

This project collects the code, notes, configs, prompts, logs, and evaluations for tuning the AWS-hosted cloud agent.

## Structure

- `notes/` - working notes, decisions, and investigation logs
- `prompts/` - system prompts, agent instructions, and prompt versions
- `evals/` - test cases and evaluation results
- `configs/` - deployment and runtime configuration references
- `scripts/` - local helper scripts for testing and analysis

## Current Goal

Use Codex to inspect, tune, test, and improve the AWS-hosted agent/service.

## Current Deployment Target

AWS Lightsail with OpenClaw already installed.

OpenClaw channels currently configured or investigated:

- Telegram chatbot: `notes/openclaw-lightsail-telegram-config.md`
- WhatsApp channel: `notes/whatsapp-channel-setup.md`
- Google Meet plugin: `notes/google-meet-plugin-setup.md`
