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

Primary next step: configure OpenClaw's native Telegram channel on the Lightsail instance.

See `notes/openclaw-lightsail-telegram-config.md`.
