# DeAgent Ledger Plugin

Solana Ledgerability adapter for OpenClaw.

This plugin is intentionally independent from OpenClaw core logic. It exposes a small JavaScript API that can be loaded as an OpenClaw plugin or imported directly by an AWS worker.

## Phase 1 Scope

- Devnet only.
- No mainnet support.
- No token transfer.
- Agent PDA: implemented through the existing OpenClaw invocation program.
- Invocation PDA: implemented through the existing OpenClaw invocation program.
- Reputation PDA: deterministic address and read helper only. The current devnet program does not create a reputation account yet.
- Escrow: API reserved for phase 2. `depositEscrow()` and `releasePayment()` return `not_implemented` and do not transfer funds.

## Unified API

```js
import { createDeAgentLedger } from "./index.js";

const ledger = createDeAgentLedger({
  ownerKeypairPath: process.env.OWNER_KEYPAIR,
  requesterKeypairPath: process.env.REQUESTER_KEYPAIR,
  agentSignerKeypairPath: process.env.AGENT_SIGNER_KEYPAIR
});

await ledger.registerAgent({
  slug: "openclaw-aws-agent",
  manifestUri: "https://example.com/openclaw-agent-manifest.json",
  manifestHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
});

await ledger.createInvocation({
  owner: ledger.ownerPublicKey(),
  slug: "openclaw-aws-agent",
  inputJson: { task: "Summarize the request." }
});

await ledger.submitResult({
  invocation: "INVOCATION_PDA",
  agent: "AGENT_PDA",
  resultJson: { ok: true, output: "..." }
});

await ledger.readReputation({ agent: "AGENT_PDA" });
```

## Environment

```sh
cp .env.example .env
```

Defaults:

- `SOLANA_RPC_URL=https://api.devnet.solana.com`
- `DEAGENT_LEDGER_PROGRAM_ID=5SfS5maRBYUE3sEnfRX4xjNzRpPNhXPEsQjboCVKb41e`

## Notes

`registerAgent()` defaults `priceLamports` to `0` so phase 1 creates identity and invocation records without payment movement. If a caller passes a non-zero price to the underlying program, the program may escrow SOL lamports on invocation; this plugin does not use that path by default.
