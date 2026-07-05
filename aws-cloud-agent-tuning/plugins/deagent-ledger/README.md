# DeAgent Ledger Plugin

Reusable Solana Ledgerability SDK/plugin skeleton for OpenClaw.

This package is intentionally independent from OpenClaw core logic. It exposes a clean TypeScript interface that can later be wired to Solana devnet without forcing Solana configuration at compile time.

## Layout

```text
plugins/deagent-ledger/
  README.md
  package.json
  openclaw.plugin.json
  anchor/
    Anchor.toml
    Cargo.toml
    programs/
      deagent_ledger/
  src/
    index.ts
    types.ts
    config.ts
    registry.ts
    invocation.ts
    reputation.ts
    anchor.ts
    utils.ts
```

## Public API

```ts
import {
  registerAgent,
  getAgent,
  createInvocation,
  submitResult,
  updateReputation
} from "openclaw-deagent-ledger";

await registerAgent({ agentId: "openclaw-main" });
```

Current exported functions are placeholders:

- `registerAgent()`
- `getAgent()`
- `createInvocation()`
- `submitResult()`
- `updateReputation()`

Each function currently throws `Not implemented`. This is deliberate: the package should compile and load as an SDK/plugin skeleton before Solana accounts, wallets, program IDs, or RPC endpoints are configured.

## Build

```sh
npm install
npm run check
npm run build
```

## Anchor Program

The Anchor workspace lives under `anchor/` and targets Solana devnet.

Program:

- `deagent_ledger`

Instruction:

- `register_agent`
- `create_invocation`
- `submit_result`
- `initialize_reputation`
- `update_reputation`
- `deposit_escrow`
- `release_payment`

Accounts:

- `AgentAccount`
- `InvocationAccount`
- `ReputationAccount`
- `EscrowAccount`

PDA seeds:

```text
["agent", authority_pubkey, agent_id]
["invocation", agent_account, requester_pubkey, nonce_le_bytes]
["reputation", agent_account]
["escrow", invocation_account]
```

`InvocationAccount` stores:

- task hash
- status
- input URI
- output URI
- created, updated, and completed timestamps

`ReputationAccount` stores:

- score
- completed invocation count
- failed invocation count
- updated timestamp

`EscrowAccount` stores:

- invocation
- agent
- requester
- SPL token mint
- escrow vault token account
- amount
- status
- created and released timestamps

Escrow uses SPL Token CPI:

- `deposit_escrow` transfers SPL tokens from the requester token account into a program-owned vault.
- `release_payment` transfers SPL tokens from the vault to the agent authority token account.

The program does not implement SOL payments, token minting, disputes, refunds, or escrow cancellation yet.

The workspace is pinned to Anchor `0.31.1` for Solana SBF toolchain compatibility on the current devnet deploy host.

```sh
cd anchor
anchor build
```

## Architecture

- `config.ts`: config shape and defaults.
- `registry.ts`: agent registry API.
- `invocation.ts`: invocation lifecycle API.
- `reputation.ts`: reputation API.
- `anchor.ts`: future Anchor adapter boundary.
- `utils.ts`: shared helpers.
- `types.ts`: public request/response types.
