# ACP Escrow Agent Design

Date: 2026-06-17

## Goal

Design an AWS OpenClaw-side escrow/payment guard for Virtuals ACP offerings.

This agent does not replace Virtuals ACP escrow, payment, or settlement primitives. Those should remain owned by the ACP framework and its contracts/API. The OpenClaw escrow agent acts as an operational guardrail around jobs:

- verify buyer/request metadata
- enforce allowlists and policy
- verify payment/escrow state when ACP exposes it
- approve or reject job execution
- collect evidence for disputes
- route approved work to the correct OpenClaw agent
- return a structured execution record

## Roles

```text
Virtuals ACP
  Identity, offering registry, job lifecycle, payment request, escrow/settlement

AWS seller runtime
  Receives ACP jobs, calls handlers, submits deliverables

Escrow Guard Agent
  Decides whether a job is allowed to execute

Work Agent
  Does the actual task, for example market-observer or risk-evaluator
```

## Proposed OpenClaw Agents

Existing agents:

```text
main
market-observer
trend-trader
funding-trader
risk-evaluator
vault-executor
signal-agent
```

Add one new agent/instruction mode:

```text
escrow-guard
```

Responsibilities:

1. Validate requester and buyer wallet.
2. Validate job offering name and scope.
3. Validate payment/escrow status from ACP job payload.
4. Validate required funds or external resource requirements.
5. Decide `approved`, `rejected`, or `needs_manual_review`.
6. Produce an audit record.
7. Never execute trades, transfers, approvals, withdrawals, or wallet actions itself.

## Policy Model

Keep policy in a local config file, not hardcoded inside every handler:

```text
/home/ubuntu/.openclaw/workspace/.openclaw/acp-escrow-policy.json
```

Example:

```json
{
  "defaultMode": "review",
  "allowedBuyerWallets": [
    "0x..."
  ],
  "blockedBuyerWallets": [],
  "offerings": {
    "market_observer": {
      "mode": "public",
      "minFeeUSDC": 0.01,
      "maxJobValueUSDC": 1,
      "requiresPaidEscrow": true,
      "requiredStatus": ["paid", "funded", "escrowed"],
      "allowedRequestFields": ["symbol", "market", "timeframe", "question"]
    },
    "risk_evaluation": {
      "mode": "allowlist",
      "minFeeUSDC": 0.05,
      "maxJobValueUSDC": 10,
      "requiresPaidEscrow": true,
      "requiredStatus": ["paid", "funded", "escrowed"],
      "allowedRequestFields": ["symbol", "chain", "contract", "question"]
    }
  }
}
```

Mode meanings:

```text
public
  Anyone can request if ACP payment/escrow state is valid.

allowlist
  Only approved buyer wallets can request.

review
  Job is not auto-executed. Return needs_manual_review.

blocked
  Always reject.
```

## Handler Flow

Each ACP offering handler should follow this pattern:

```text
ACP job received
  -> normalize request
  -> escrow guard check
  -> if rejected: return rejection deliverable or validation error
  -> if needs_manual_review: return review message
  -> if approved: call work agent
  -> return result plus audit metadata
```

For `market_observer`:

```text
market_observer handler
  -> escrow guard validates buyer/payment/scope
  -> calls openclaw agent --agent market-observer
  -> returns market observation
```

## Request Normalization

Because ACP payload field names may change or vary, normalize request data first:

```ts
type NormalizedAcpJob = {
  jobId?: string;
  offeringName: string;
  buyerWallet?: string;
  payerWallet?: string;
  providerWallet?: string;
  feeAmount?: number;
  feeToken?: string;
  paymentStatus?: string;
  escrowStatus?: string;
  createdAt?: string;
  requirements: Record<string, unknown>;
  raw: unknown;
};
```

Possible source paths to inspect:

```text
request.jobId
request.id
request.buyerWallet
request.buyer.walletAddress
request.payerWallet
request.payment.status
request.escrow.status
request.requirement
request.requirements
request.input
```

## Escrow Decision Output

The guard should return structured JSON:

```json
{
  "decision": "approved",
  "reason": "Buyer and escrow state accepted.",
  "offeringName": "market_observer",
  "buyerWallet": "0x...",
  "paymentStatus": "escrowed",
  "checks": [
    { "name": "offering_policy", "status": "pass" },
    { "name": "buyer_allowlist", "status": "pass" },
    { "name": "payment_status", "status": "pass" },
    { "name": "fee_amount", "status": "pass" }
  ]
}
```

Decision values:

```text
approved
rejected
needs_manual_review
```

## What ACP Should Still Own

Do not implement these in OpenClaw unless ACP explicitly delegates them:

- custody of funds
- escrow contract execution
- settlement transaction
- refund transaction
- wallet approvals
- token transfers
- payment signatures

The OpenClaw escrow guard should only verify status and enforce local policy.

## First Implementation Step

Create a shared guard module in the Virtuals ACP skill:

```text
/home/ubuntu/.openclaw/workspace/skills/virtuals-protocol-acp/src/seller/lib/escrowGuard.ts
```

Then update:

```text
src/seller/offerings/market_observer/handlers.ts
```

to call:

```ts
const decision = await evaluateEscrowGuard("market_observer", request);
```

before it calls:

```sh
openclaw agent --agent market-observer
```

## MVP Policy

For the current `market_observer` offering:

```json
{
  "mode": "public",
  "minFeeUSDC": 0.01,
  "requiresPaidEscrow": false
}
```

Why `requiresPaidEscrow: false` for MVP:

- we have not yet inspected the real ACP job payload from a buyer transaction
- setting it to false lets us accept test jobs while logging available payment fields
- after the first real Butler/buyer test, tighten it to require `paid`, `funded`, or `escrowed`

## Hardening After First Live Test

After a real job comes in, inspect `seller.log` and update normalization for the actual ACP payload fields.

Then enable:

```json
{
  "requiresPaidEscrow": true,
  "requiredStatus": ["paid", "funded", "escrowed"]
}
```

For private or higher-value jobs, switch mode:

```json
{
  "mode": "allowlist",
  "allowedBuyerWallets": ["0x..."]
}
```

## Future Offerings

Possible escrow-guarded offerings:

```text
market_observer
risk_evaluation
funding_rate_analysis
signal_generation
token_intelligence_report
```

For `token_intelligence_report`, the handler can orchestrate:

```text
escrow-guard
  -> market-observer
  -> funding-trader
  -> risk-evaluator
  -> signal-agent
  -> final report synthesis
```

## 2026-06-17 Runtime Ledger MVP

Implemented the first ledger-only OpenClaw runtime escrow layer on the AWS Lightsail OpenClaw instance.

Installed files:

```text
/home/ubuntu/.openclaw/workspace/tools/escrow-ledger.js
/home/ubuntu/.openclaw/workspace/escrow/ledger.json
/home/ubuntu/.openclaw/workspace/escrow/policy.json
/home/ubuntu/.openclaw/workspace/.openclaw/skills/openclaw-runtime-escrow/SKILL.md
/home/ubuntu/bin/escrow-ledger -> /home/ubuntu/.openclaw/workspace/tools/escrow-ledger.js
```

The MVP is intentionally ledger-only:

```text
No private keys
No signatures
No token approvals
No real transfers
No real release/refund execution
```

Supported CLI:

```sh
escrow-ledger help
escrow-ledger policy
escrow-ledger create --buyer 0xBuyer --provider Xtoken2000 --offering market_observer --amount 0.01 --token USDC --terms "BTC 4h market observation"
escrow-ledger list
escrow-ledger show <escrow_id>
escrow-ledger fund <escrow_id> --tx simulated_tx
escrow-ledger lock <escrow_id>
escrow-ledger start <escrow_id>
escrow-ledger deliver <escrow_id> --artifact "deliverable summary or path"
escrow-ledger recommend-release <escrow_id> --reason "deliverable meets terms"
escrow-ledger recommend-refund <escrow_id> --reason "refund reason"
escrow-ledger release <escrow_id> --approved-by human
escrow-ledger refund <escrow_id> --approved-by human
escrow-ledger dispute <escrow_id> --reason "dispute reason"
```

Status machine:

```text
created
awaiting_funds
funded
locked
work_started
delivered
release_recommended
refund_recommended
released
refunded
cancelled
disputed
```

Policy:

```json
{
  "mode": "ledger_only",
  "realWalletMovement": false,
  "requireHumanApprovalForRelease": true,
  "maxSimulatedJobValueUSDC": 100,
  "allowedTokens": ["USDC"],
  "allowedProviders": ["Xtoken2000"]
}
```

Smoke test completed:

```text
create -> awaiting_funds
fund -> funded
lock -> locked
start -> work_started
deliver -> delivered
recommend-release -> release_recommended
release --approved-by human -> released
```

The final event explicitly records:

```text
Ledger-only release. Wallet executor not enabled.
```

Security note:

During the Lightsail reconnect flow, the OpenClaw browser dashboard access token was visible on screen. Rotate the OpenClaw gateway/dashboard token before using this runtime for sensitive production workflows.

## 2026-06-17 Telegram Chat Escrow Test

Goal:

```text
Each Telegram bot chat request creates one OpenClaw runtime escrow ledger job.
When the bot response is completed, the ledger marks the job delivered and released.
```

MVP behavior:

```text
Telegram-like message input
  -> create escrow job
  -> mark funded with simulated payment
  -> lock funds in ledger
  -> start work
  -> call OpenClaw main agent
  -> record response as deliverable
  -> recommend release
  -> release with simulated human/test approval
```

This does not move real funds. It only tests the runtime escrow lifecycle.

Implemented AWS script:

```text
/home/ubuntu/.openclaw/workspace/tools/telegram-escrow-chat.js
/home/ubuntu/bin/telegram-escrow-chat
```

CLI:

```sh
telegram-escrow-chat --from 8686051916 --username xtoke2000 --amount 0.01 --message "Test escrow chat"
telegram-escrow-chat --from 8686051916 --username xtoke2000 --amount 0.01 --message "Test escrow chat" --dry-run
```

Observed output shape:

```json
{
  "ok": true,
  "escrowId": "escrow_...",
  "status": "released",
  "reply": "..."
}
```

Tested ledger entries:

```text
escrow_0b8cc4125504  telegram_chat  telegram:8686051916:xtoke2000  0.01 USDC  released
escrow_3ae75f9cee18  telegram_chat  telegram:8686051916:xtoke2000  0.01 USDC  released
escrow_2769e59d4afa  telegram_chat  telegram:8686051916:xtoke2000  0.01 USDC  released
escrow_d303f63fb59c  telegram_chat  telegram:8686051916:xtoke2000  0.01 USDC  released
```

Current runtime note:

```text
The escrow lifecycle works end to end.
The previous OpenClaw gateway token mismatch was caused by a stale OPENCLAW_GATEWAY_TOKEN exported from /home/ubuntu/.bashrc and also present in the user systemd environment.
Fix applied on AWS:
- backed up /home/ubuntu/.bashrc to /home/ubuntu/.bashrc.bak-openclaw-token-20260617
- disabled the stale export OPENCLAW_GATEWAY_TOKEN line in /home/ubuntu/.bashrc
- ran systemctl --user unset-environment OPENCLAW_GATEWAY_TOKEN
- unset OPENCLAW_GATEWAY_TOKEN in the active terminal
- verified the shell no longer has OPENCLAW_GATEWAY_TOKEN and gateway.auth.token equals gateway.remote.token in /home/ubuntu/.openclaw/openclaw.json

After the token fix, OpenClaw calls no longer fail with gateway token mismatch.
The next blocker is a separate OpenClaw authorization issue: scope upgrade pending approval.
The Telegram escrow bridge still records delivered/released using its embedded fallback response while scope approval is pending.
```

Future real Telegram integration options:

1. Instruction-layer integration:
   - OpenClaw Telegram agent is instructed to use the escrow ledger for every chat.
   - Lowest risk, but depends on tool availability in the agent runtime.

2. Bridge integration:
   - Telegram webhook goes through a small local service.
   - The service creates escrow ledger jobs before forwarding to OpenClaw.
   - Most deterministic.

3. Native OpenClaw channel plugin modification:
   - Hook directly into Telegram channel handling.
   - Most integrated, but highest maintenance risk.

Recommended next step:

```text
Implement the bridge/test CLI first, then decide whether to attach it to real Telegram inbound messages.
```

## 2026-06-17 Runtime Commerce Skill Direction

The better long-term architecture is not a Telegram-specific bridge. Telegram should be just one channel adapter.

The shared layer should be an OpenClaw Runtime Commerce skill:

```text
Telegram / Virtuals ACP / Web API / Farcaster / WhatsApp
        |
        v
OpenClaw Runtime Commerce Skill
  - JobEnvelope normalization
  - ledger-only escrow lifecycle
  - policy checks
  - work-agent routing
  - evaluator-agent hook
  - wallet-executor hook
        |
        v
Work agents
  - main
  - market-observer
  - risk-evaluator
  - signal-agent
  - funding-trader
  - vault-executor
```

Implemented repo prototype:

```text
aws-cloud-agent-tuning/skills/openclaw-runtime-commerce/
aws-cloud-agent-tuning/scripts/install-openclaw-runtime-commerce.sh
```

Core command shape:

```sh
commerce-job run \
  --source telegram \
  --source-user telegram:8686051916:xtoke2000 \
  --offering telegram_chat \
  --agent main \
  --amount 0.01 \
  --token USDC \
  --input "hello" \
  --dry-run
```

The prototype creates one normalized commerce job and moves it through:

```text
created
awaiting_funds
funded
locked
work_started
delivered
release_recommended
released
```

This is the preferred foundation for future evaluator and wallet-executor agents.

## 2026-06-17 Telegram Chat Evaluator v1

Implemented the first evaluator inside the OpenClaw Runtime Commerce skill:

```text
aws-cloud-agent-tuning/skills/openclaw-runtime-commerce/src/evaluators/telegram-chat.js
```

Purpose:

```text
Telegram chat completed
  -> evaluator reads original input and delivered reply
  -> evaluator emits pass / fail / needs_review
  -> commerce flow maps that to release / refund / dispute
```

Current rule-based checks:

```text
non_empty_reply
  Reply artifact must exist.

no_error_marker
  Reply should not contain obvious runtime failure markers such as error, failed, unauthorized, mismatch, exception, traceback, missing.

basic_relevance
  First-pass lightweight relevance check using token overlap and minimum reply length.
```

Output shape:

```json
{
  "evaluator": "telegram-chat-v1",
  "verdict": "pass",
  "decision": "release_recommended",
  "score": 0.9,
  "reason": "Telegram chat reply is present and passes the basic completion checks.",
  "checks": [
    { "name": "non_empty_reply", "status": "pass" },
    { "name": "no_error_marker", "status": "pass" },
    { "name": "basic_relevance", "status": "pass" }
  ]
}
```

Decision mapping:

```text
pass
  -> release_recommended
  -> released in ledger-only mode

fail
  -> refund_recommended

needs_review
  -> disputed / manual review
```

Next evaluator phase:

```text
Replace or augment telegram-chat-v1 with an evaluator-agent that can reason over input, terms, reply quality, and channel context.
```

## 2026-06-17 Telegram Runtime Commerce Adapter

Implemented a Telegram inbound adapter that calls the channel-agnostic Runtime Commerce skill instead of the older Telegram-specific escrow bridge.

Repo file:

```text
aws-cloud-agent-tuning/scripts/install-telegram-commerce-adapter.sh
```

Runtime install target:

```text
$OPENCLAW_WORKSPACE/tools/telegram-commerce-adapter.js
$HOME/bin/telegram-commerce-adapter
$HOME/.config/systemd/user/telegram-commerce-adapter.service
```

Message flow:

```text
Telegram getUpdates
  -> telegram-commerce-adapter
  -> commerce-job run --source telegram --offering telegram_chat
  -> JobEnvelope
  -> ledger-only escrow lifecycle
  -> work agent / fallback
  -> telegram-chat-v1 evaluator
  -> released / refund_recommended / disputed
  -> Telegram reply containing job id, status, evaluator, verdict, and score
```

Important channel note:

```text
Do not run multiple consumers against the same Telegram bot token unless they are coordinated.
OpenClaw's native Telegram channel and telegram-commerce-adapter can compete for getUpdates.
For a clean test, run only telegram-commerce-adapter as the bot update consumer.
```

Test commands on AWS:

```sh
bash /path/to/aws-cloud-agent-tuning/scripts/install-openclaw-runtime-commerce.sh
bash /path/to/aws-cloud-agent-tuning/scripts/install-telegram-commerce-adapter.sh
telegram-commerce-adapter --once --dry-run
systemctl --user enable --now telegram-commerce-adapter.service
systemctl --user status telegram-commerce-adapter.service --no-pager
```
