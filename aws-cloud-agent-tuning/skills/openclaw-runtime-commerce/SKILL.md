# OpenClaw Runtime Commerce

Channel-agnostic commerce lifecycle skill for OpenClaw jobs.

This skill turns work from Telegram, Virtuals ACP, Web/API, Farcaster, WhatsApp, and future channels into one normalized `JobEnvelope`, then runs a shared commerce flow:

```text
normalize request
  -> create ledger escrow
  -> apply policy
  -> route to work agent
  -> record deliverable
  -> evaluator decision
  -> release / refund / dispute recommendation
```

The current implementation is intentionally `ledger_only`.

It does not:

- hold private keys
- sign transactions
- approve token allowances
- transfer tokens
- release or refund real funds

Future phases add:

- evaluator-agent integrations
- wallet-executor integrations
- channel hooks for Telegram, ACP, Web/API, Farcaster, and WhatsApp

## Commands

```sh
commerce-job help
commerce-job run --source telegram --source-user telegram:123:alice --offering telegram_chat --agent main --amount 0.01 --token USDC --input "hello"
commerce-job list
commerce-job show <job_id>
commerce-ledger list
commerce-ledger show <job_id>
commerce-evaluate --job <job_id>
```

## Ledger

Default ledger path:

```text
$OPENCLAW_WORKSPACE/commerce/ledger.json
```

Default policy path:

```text
$OPENCLAW_WORKSPACE/commerce/policy.json
```

