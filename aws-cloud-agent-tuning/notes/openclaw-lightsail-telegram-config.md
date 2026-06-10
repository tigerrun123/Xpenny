# OpenClaw on AWS Lightsail: Telegram Config Plan

OpenClaw is already installed on the Lightsail instance. The next job is to configure the existing OpenClaw Gateway and Telegram channel.

## Target

Telegram user -> OpenClaw Telegram channel -> OpenClaw Gateway -> LiveSailing/OpenClaw agent -> Telegram reply

## Preferred Config Path

Use OpenClaw's native onboarding and channel configuration:

```sh
openclaw onboard --install-daemon
openclaw gateway status
openclaw doctor
```

During onboarding, choose Telegram as a channel and paste the Telegram bot token from BotFather.

## Safe Telegram Access

Keep DM access in pairing mode first:

```text
dmPolicy = pairing
```

Then approve only your Telegram account when OpenClaw returns a pairing code:

```sh
openclaw pairing approve telegram <code>
```

Avoid public/open DM mode until the bot behavior is tested.

## Lightsail Checklist

1. SSH into the Lightsail instance.
2. Confirm Node runtime is Node 24 or Node 22.19+.
3. Confirm OpenClaw is installed:

```sh
openclaw --version
```

4. Run diagnostics:

```sh
openclaw doctor
openclaw gateway status
```

5. Run onboarding if the Telegram channel is not configured:

```sh
openclaw onboard --install-daemon
```

6. Restart the gateway:

```sh
openclaw gateway stop
openclaw gateway --port 18789 --verbose
```

Or use the daemon that onboarding installed.

## What I Need To Configure It Directly

To do the configuration myself, I need one of these:

- SSH command for the Lightsail instance, for example `ssh ubuntu@x.x.x.x`
- The OpenClaw install directory or config path
- Telegram bot token already present on the server, or permission for you to paste it into the server-side `.env`

Do not paste AWS secret keys or Telegram tokens into chat unless you are comfortable rotating them afterward.

## 2026-06-10 Lightsail Session

Instance:

- Name: `XtokenOpenClaw`
- Public IPv4: `3.106.124.207`
- SSH user: `ubuntu`
- OpenClaw version: `2026.5.7`

Findings:

- OpenClaw Gateway runs as user service `openclaw-gateway.service`.
- Gateway listens locally on `127.0.0.1:18789`.
- Telegram provider is configured as `@xtoken2000_bot`.
- Health initially failed with `gateway token mismatch`.

Changes made:

- Generated a new Gateway auth token locally on the Lightsail instance without printing it.
- Set `gateway.auth.mode` to `token`.
- Set `gateway.auth.token` to the new generated token.
- Restarted the Gateway with `openclaw gateway restart`.

Verification:

- `openclaw health` now reports `Telegram: configured`.
- Gateway event loop reports `ok`.
- Default agent is `main`.
- Local agent test returned `OpenClaw Telegram config test OK`.
- Telegram bot token was updated through silent terminal input and verified with Telegram `getMe`.
- Verified Telegram username: `xtoken2000_bot`.

Remaining:

- End-to-end Telegram reply should be tested by messaging `@xtoken2000_bot` from the approved Telegram account.
- A CLI device scope upgrade request appeared during local agent testing. It was not approved automatically.
- Because the bot token was pasted into chat, consider regenerating it in BotFather after end-to-end testing and reapplying the new token the same way.

## 2026-06-10 Telegram DM Allowlist Update

The first Telegram DM was received by OpenClaw but created a pairing request instead of an agent reply.

Observed Telegram sender:

- Telegram user id: `8686051916`
- Username observed in logs: `xtoke2000`
- Display name observed in logs: `Tiger Oracle`

Changes made:

- Set `channels.telegram.dmPolicy` to `allowlist`.
- Set `channels.telegram.allowFrom` to `[8686051916]`.
- Restarted `openclaw-gateway.service`.

Verification:

- OpenClaw hot reload detected the Telegram config change.
- Telegram channel restarted.
- `openclaw health` still reports `Telegram: configured`.

Next verification:

- Send a fresh Telegram DM to `@xtoken2000_bot` after this allowlist update.

## 2026-06-10 Waiter/Waitress Agent Experiment

Goal:

- Turn the OpenClaw Telegram agent into a mock restaurant waiter/waitress for Chinese food ordering tests.

Server changes:

- Added a workspace skill directory:
  `/home/ubuntu/.openclaw/workspace/.openclaw/skills/chinese-restaurant-waiter/`
- Added `SKILL.md` and `menu.json` with mock Tiger Garden Chinese Kitchen menu data.
- Added `Restaurant Waiter Mode` to `/home/ubuntu/.openclaw/workspace/IDENTITY.md` so the main agent reliably uses the fixed restaurant menu and AUD prices.

Verification:

- Ran a local OpenClaw agent test:
  `Restaurant waiter test. Use Tiger Garden Chinese Kitchen exact menu. Order: 1 Kung Pao Chicken and 1 Steamed Rice. Show receipt total in AUD.`
- Verified output used:
  - `M01 Kung Pao Chicken x 1 - AUD 19.80`
  - `R01 Steamed Rice x 1 - AUD 3.50`
  - Total: `AUD 23.30`
- Verified the agent asks for pickup, dine-in, or mock delivery before final confirmation.

Operational note:

- The web SSH terminal can corrupt Chinese text typed directly into CLI commands. Telegram should be used for Chinese-language end-to-end tests.
