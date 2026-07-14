# OpenClaw Solana DeAgent DApp

Production-oriented Devnet MVP connecting OpenClaw off-chain agents to a Solana Anchor escrow/evaluation protocol.

OpenClaw does the intelligent work off-chain: prompts, code, reports, files, and evidence stay outside Solana. The Solana program guarantees job state transitions, PDA identity, escrow rules, evaluator decisions, and single settlement/refund. Only hashes, URIs, public identities, amounts, timestamps, and state are stored on-chain.

Wallet = signer/owner. Treasury = worker token account that receives approved payments. Job escrow = token account controlled by an escrow PDA for one job.

Plugin = OpenClaw package exposing tools. Tool = one callable JSON-schema operation. Skill = workflow instructions for using tools. Solana Program = on-chain Anchor protocol.

Lifecycle: initialize protocol → register agents → create job → fund escrow → worker accepts → start → submit result hash/URI → evaluator approves/rejects → settle approved payment or refund cancelled/rejected job.

## Run locally

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

## Anchor/local validator

```bash
solana-test-validator
anchor build
anchor test
```

## Devnet deploy

```bash
solana config set --url devnet
anchor build
anchor deploy --provider.cluster devnet
```

Do not use real secrets. Create Devnet test tokens with SPL Token CLI and set public mint addresses in `.env`.

## Plugin install

Install `packages/openclaw-solana-plugin`, configure `config/policy.devnet.json`, and keep `agent_wallet.enabled=false` unless a narrowly authorized operational wallet is configured.

## MVP limitations

No token/DAO/NFT/staking/marketplace/mainnet. IDL-backed SDK transaction construction is scaffolded and must be completed after Anchor IDL generation. UI is intentionally minimal.

## Next phases

Finish generated IDL integration, expand Anchor tests against local validator, add wallet-adapter signing implementation, add GitHub PR work-order workflow, audit before any mainnet work.
