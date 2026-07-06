# Virtuals ACP Skill on AWS OpenClaw

Date: 2026-06-17

## Goal

Move the existing Virtuals ACP / OpenClaw connection away from the old Kimi Claw cloud runtime and attach it to the AWS Lightsail OpenClaw runtime.

Current understanding:

- Virtuals ACP is the agent entry, wallet, API access, and commerce/network side.
- OpenClaw on AWS is the execution runtime.
- The Virtuals page shows this ClawHub install command:

```sh
npx clawhub@latest install virtuals-protocol-acp
```

## Known Virtuals Agent

From the saved screenshot:

- Agent name: `Xtoken2000`
- Virtuals ACP URL: `https://app.virtuals.io/acp/agent/22828`
- Virtuals agent id: `22828`
- Agent type/tag: `OpenClaw`
- Agent wallet shown in UI: `0x828...A48e6`

Do not paste the full API key, wallet private key, Telegram token, or OpenClaw gateway token into chat or commit them to this repo.

## AWS Runtime

From existing notes:

- AWS Lightsail instance: `XtokenOpenClaw`
- Public IPv4 observed on 2026-06-10: `3.106.124.207`
- SSH user: `ubuntu`
- OpenClaw version after upgrade: `2026.6.5`
- Gateway service: `openclaw-gateway.service`
- Gateway local port: `127.0.0.1:18789`
- Workspace path used previously: `/home/ubuntu/.openclaw/workspace`

## Install And Configure

Run these commands on the AWS instance, not locally.

### 1. SSH

```sh
ssh ubuntu@3.106.124.207
```

If this fails with `Permission denied (publickey)`, use the Lightsail browser SSH console or the terminal that has the correct private key.

### 2. Preflight

```sh
openclaw --version
openclaw health
openclaw plugins doctor
```

If the shell cannot talk to the gateway, export the local gateway token without printing it:

```sh
export OPENCLAW_GATEWAY_TOKEN="$(node -pe "require('/home/ubuntu/.openclaw/openclaw.json').gateway.auth.token")"
```

Then retry:

```sh
openclaw health
```

### 3. Backup

```sh
mkdir -p /home/ubuntu/.openclaw/backups
cp -a /home/ubuntu/.openclaw "/home/ubuntu/.openclaw/backups/pre-virtuals-acp-$(date +%Y%m%d-%H%M%S)"
```

If the copy complains about copying the backup folder into itself, use this safer variant:

```sh
tar --exclude='/home/ubuntu/.openclaw/backups' -czf "/home/ubuntu/.openclaw/backups/pre-virtuals-acp-$(date +%Y%m%d-%H%M%S).tgz" -C /home/ubuntu .openclaw
```

### 4. Install The Virtuals ACP Skill

Use the command from the Virtuals ACP UI:

```sh
npx clawhub@latest install virtuals-protocol-acp
```

If ClawHub asks for the target runtime/workspace, choose the existing AWS OpenClaw workspace:

```text
/home/ubuntu/.openclaw/workspace
```

After install, inspect what was added:

```sh
find /home/ubuntu/.openclaw -iname '*virtuals*' -o -iname '*acp*'
openclaw plugins doctor
openclaw health
```

### 5. Configure Virtuals Credentials

Open the Virtuals ACP page:

```text
https://app.virtuals.io/acp/agent/22828
```

Generate or copy the API key from `API Access`.

Prefer a server-side secret file or OpenClaw secret store. The exact config keys depend on the installed skill, so inspect the installed skill docs first:

```sh
find /home/ubuntu/.openclaw -iname 'SKILL.md' -print | xargs grep -n "Virtuals\\|ACP\\|API\\|VIRTUALS\\|agent"
```

Likely values to configure:

```text
VIRTUALS_ACP_API_KEY=<from Virtuals API Access>
VIRTUALS_ACP_AGENT_ID=22828
VIRTUALS_ACP_AGENT_NAME=Xtoken2000
VIRTUALS_ACP_AGENT_WALLET=<full agent wallet address if required>
```

If the skill exposes an OpenClaw command, prefer that over editing JSON by hand. Check with:

```sh
openclaw --help | grep -i virtuals
openclaw --help | grep -i acp
```

### 6. Restart

```sh
openclaw gateway restart
openclaw health
openclaw plugins doctor
```

If systemd owns the gateway:

```sh
systemctl --user restart openclaw-gateway.service
systemctl --user status openclaw-gateway.service --no-pager
```

### 7. Test

Local CLI test:

```sh
openclaw "Virtuals ACP status check. Confirm whether the Virtuals ACP skill is installed and what agent id/name it is configured for. Do not reveal secrets."
```

Telegram or WhatsApp test:

```text
Virtuals ACP status check. Are you connected as Xtoken2000 on agent id 22828? Do not reveal API keys.
```

Then check logs:

```sh
openclaw health
openclaw plugins doctor
journalctl --user -u openclaw-gateway.service -n 120 --no-pager
```

## Expected Final Shape

```text
Virtuals ACP agent entry / API key / wallet
        |
        v
virtuals-protocol-acp skill installed by ClawHub
        |
        v
AWS Lightsail OpenClaw runtime
        |
        v
Telegram / WhatsApp / Xpenny / other channels
```

## Current Blocker For Direct Codex Setup

Codex attempted a read-only SSH check from this machine:

```sh
ssh -o BatchMode=yes -o ConnectTimeout=8 ubuntu@3.106.124.207 'openclaw --version'
```

Network access was allowed, but AWS rejected the local key:

```text
Permission denied (publickey).
```

To let Codex complete the install directly, provide access through one of these:

- Run Codex from a machine/profile that already has the Lightsail SSH key.
- Add the correct SSH key to this environment.
- Use the Lightsail browser SSH console and paste the runbook commands.

## 2026-06-17 Setup Session

Performed through the AWS Lightsail browser SSH terminal.

### Installed

Installed the Virtuals ACP skill into the AWS OpenClaw workspace:

```sh
npx -y clawhub@latest install virtuals-protocol-acp
```

Installed the skill's local Node dependencies:

```sh
cd /home/ubuntu/.openclaw/workspace/skills/virtuals-protocol-acp
npm install
```

Observed npm audit output:

```text
8 vulnerabilities (2 moderate, 6 high)
```

No `npm audit fix` was run because it may change package versions. Review separately before applying dependency changes.

### Backup

Created backups under:

```text
/home/ubuntu/.openclaw/backups/
```

Observed backup files:

```text
pre-virtuals-acp-20260617-001547.tgz
pre-virtuals-acp-20260617-001806.tgz
```

### Virtuals ACP Binding

Ran:

```sh
npm run setup
```

Authenticated to Virtuals/EconomyOS through:

```text
https://app.virtuals.io/acp/auth
```

Selected the existing Virtuals ACP agent:

```text
Xtoken2000
Agent id: 22828
Wallet: 0x82816294663C6F6FefDc3Eb9bc2B3869B93A48e6
```

Skipped optional agent token launch/tokenization by answering `n`.

The setup generated/stored a local `config.json` in the skill directory. Do not print, share, or commit that file; it contains the ACP session/API credentials.

### Runtime

Started the seller runtime:

```sh
npm run seller:run
```

Verified:

```text
Seller Runtime: Running
PID: 1039197
Log: /home/ubuntu/.openclaw/workspace/skills/virtuals-protocol-acp/logs/seller.log
```

The runtime warned:

```text
No offerings registered on ACP. Run `acp sell create <name>` first.
```

This means the AWS runtime is connected, but no ACP sell offering/service has been published yet.

### Final Verification

```sh
npm run seller:check
openclaw health
openclaw plugins doctor
```

Observed:

```text
Seller Runtime: Running
Telegram: configured
Gateway event loop: ok
No plugin issues detected.
```

### Security Note

During verification, `config.json` was accidentally printed in the Lightsail terminal. The terminal output included ACP credential material. The second `npm run setup` reported the API key as `unchanged`, so it did not rotate the key.

Recommended cleanup:

1. Open the Virtuals ACP agent page.
2. Go to `API Access`.
3. Regenerate the API key for `Xtoken2000`.
4. Re-run `npm run setup` on the AWS instance or update the skill config through the supported setup flow.
5. Restart seller runtime and verify `npm run seller:check`.

### Next Step

Create at least one ACP offering so other agents can buy/request work from this OpenClaw runtime:

```sh
cd /home/ubuntu/.openclaw/workspace/skills/virtuals-protocol-acp
npm run acp -- sell create <offering-name>
npm run acp -- sell list
npm run seller:check
```

## 2026-06-17 Market Observer Offering

Created the first ACP job offering for the AWS OpenClaw runtime.

### Scaffold

The first direct create attempt failed because the offering directory did not exist:

```text
Offering directory not found: .../src/seller/offerings/market-observer
Create it with: acp sell init market-observer
```

Scaffolded the offering:

```sh
cd /home/ubuntu/.openclaw/workspace/skills/virtuals-protocol-acp
npm run acp -- sell init market-observer
```

This created:

```text
src/seller/offerings/market-observer/offering.json
src/seller/offerings/market-observer/handlers.ts
```

### Handler

Implemented `executeJob()` in `handlers.ts` to call the AWS OpenClaw agent:

```sh
openclaw agent --agent market-observer -m "<ACP job prompt>"
```

The handler builds a market-observer prompt from ACP request fields such as:

```text
symbol
market
timeframe
question
```

It returns the OpenClaw response as the ACP job deliverable.

### ACP Registration Fixes

The first registration failed because free fixed-price jobs are rejected:

```text
For price type "fixed", value must be at least 0.01
```

Set:

```json
"jobFee": 0.01,
"jobFeeType": "fixed"
```

The second registration failed because ACP job names cannot contain hyphens:

```text
Job name must start with a lowercase letter and contain only letters, numbers, and underscores
```

Renamed:

```text
market-observer -> market_observer
```

### Published Offering

Registered successfully:

```sh
npm run acp -- sell create market_observer
```

Observed:

```text
Validation passed!
Offering registered successfully.
```

Verified:

```sh
npm run acp -- sell list
npm run seller:check
```

Observed:

```text
market_observer
Fee: 0.01 USDC
Funds required: false
Status: Listed

Seller Runtime: Running
PID: 1040677
```

### Smoke Test

Ran a local handler smoke test with:

```text
symbol: BTC
market: spot/perps
timeframe: 4h
question: Give a short smoke test market observation.
```

The handler successfully called OpenClaw `market-observer` and returned a JSON-style market observation with:

```text
asset
market
timeframe
observed_at_utc
summary
trend_view
risk_notes
confidence
next_actions
financial_advice: false
```

### Virtuals UI Verification

Opened Virtuals Agentic Commerce scan/offering UI and searched:

```text
market_observer
```

Observed `Xtoken2000` in the results with `Market Observer`, and the `Xtoken2000` detail page showed:

```text
What I Offer
market_observer
Fee: 0.01
Estimated time: 5min
```

The `Trade` button appeared inactive while viewing from the provider account, likely because the connected account owns the provider. Test job submission should be done from a separate buyer/requester account or Butler flow that is allowed to purchase/request from `Xtoken2000`.
