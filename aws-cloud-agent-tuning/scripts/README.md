# Scripts

Use this folder for local helper scripts.

- `lightsail-openclaw-check.sh`: basic AWS OpenClaw runtime diagnostics.
- `assign-openclaw-aws-agent-registry.sh`: create/update a DynamoDB agent registry entry and assign OpenClaw as the active AWS agent.
- `install-xpenny-openclaw-bridge.sh`: install the existing Xpenny/OpenClaw bridge.
- `install-openclaw-runtime-escrow.sh`: install the ledger-only OpenClaw runtime escrow CLI.
- `install-openclaw-runtime-commerce.sh`: install the channel-agnostic OpenClaw Runtime Commerce skill.
- `install-telegram-commerce-adapter.sh`: install the Telegram inbound adapter that converts Telegram messages into Runtime Commerce jobs.
- `install-telegram-escrow-bridge.sh`: install the Telegram inbound bridge that creates ledger-only escrow jobs per chat.
- `install-solana-blinks.sh`: install the wallet-signed SOL payment Action and Telegram-facing Blink skill into OpenClaw.
- `install-solana-agent-invocation.sh`: install the AWS Lightsail worker/web services for the Solana OpenClaw invocation MVP.
