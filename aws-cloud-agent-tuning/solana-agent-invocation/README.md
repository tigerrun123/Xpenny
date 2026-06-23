# OpenClaw Solana Invocation MVP

This stack turns an AWS-hosted OpenClaw instance into a Solana-discoverable agent:

- Solana is the invocation, identity, payment, and result-commitment layer.
- OpenClaw on AWS is the execution layer.
- PDAs give deterministic agent and invocation addresses.
- CPI to the System Program moves the requester payment into invocation escrow.
- The AWS worker watches Solana, runs OpenClaw, and completes the invocation on-chain.

## Architecture

```text
User / dApp
  -> create_invocation(agent, input_hash, input_uri, payment)
  -> Solana Invocation Program stores Invocation PDA
  -> AWS worker detects pending invocation
  -> AWS OpenClaw executes the task
  -> worker submits complete_invocation(result_hash, result_uri)
  -> program releases escrow to the agent owner
```

## Project Layout

```text
Anchor.toml
programs/openclaw_invocation/   # Anchor program
src/                            # TypeScript clients and AWS worker
web/                            # tiny payload hashing demo
.env.example
```

## On-Chain Model

Agent PDA:

```text
["agent", owner_pubkey, agent_slug]
```

Invocation PDA:

```text
["invocation", agent_pda, requester_pubkey, nonce_le_bytes]
```

Main instructions:

- `register_agent`: creates the agent identity and stores its manifest.
- `update_agent`: rotates signer, price, manifest, or active status.
- `create_invocation`: creates an invocation PDA and escrows lamports.
- `complete_invocation`: requires the agent signer and releases escrow.
- `cancel_invocation`: lets the requester cancel a still-pending invocation.

## Setup

Install Solana, Anchor, Node.js, then install dependencies:

```sh
npm install
```

Copy env:

```sh
cp .env.example .env
```

Create the owner and agent signer keypairs:

```sh
solana-keygen new -o ~/.config/solana/owner.json
solana-keygen new -o ~/.config/solana/openclaw-agent-signer.json
```

Fund the owner on devnet:

```sh
solana airdrop 2 --url devnet ~/.config/solana/owner.json
```

Update `.env` with:

```sh
SOLANA_RPC_URL=https://api.devnet.solana.com
OWNER_KEYPAIR=/home/ubuntu/.config/solana/owner.json
AGENT_SIGNER_KEYPAIR=/home/ubuntu/.config/solana/openclaw-agent-signer.json
AGENT_SLUG=lobster
AGENT_MANIFEST_URI=https://your-domain.example/openclaw-agent-manifest.json
AGENT_MANIFEST_HASH=<sha256 hex of manifest json>
AGENT_PRICE_LAMPORTS=1000000
OPENCLAW_TASK_URL=http://127.0.0.1:3040/tasks
```

## Build And Deploy Program

Replace the placeholder program id in:

- `Anchor.toml`
- `programs/openclaw_invocation/src/lib.rs`
- `.env` `PROGRAM_ID`

Then:

```sh
anchor build
anchor deploy --provider.cluster devnet
```

## Register Your AWS OpenClaw Agent

```sh
npm run register-agent
```

The command prints the agent PDA. Put that PDA in your website, agent marketplace, or registry indexer.

## Create An Invocation

For quick testing with an inline JSON payload:

```sh
npm run invoke-agent -- --input-json='{"task":"Summarize Solana PDA and CPI for a non-technical user.","mode":"research"}'
```

For production, upload the JSON payload to S3, IPFS, or Arweave and invoke by URI:

```sh
npm run invoke-agent -- --input-uri=https://your-bucket.s3.amazonaws.com/invocations/001.json
```

## Run The AWS Worker

Run this on the same AWS box or private network where OpenClaw is reachable:

```sh
npm run worker
```

The worker:

1. Polls invocation accounts for your agent PDA.
2. Fetches the task payload.
3. Calls `OPENCLAW_TASK_URL`.
4. Hashes the result.
5. Calls `complete_invocation`.

The expected OpenClaw HTTP adapter contract is:

```http
POST /tasks
content-type: application/json

{
  "source": "solana-invocation",
  "payload": {
    "task": "..."
  }
}
```

Response:

```json
{
  "ok": true,
  "output": "..."
}
```

## Payload Demo

Run:

```sh
npm run web
```

Open `http://localhost:8787`. The page helps form and hash a JSON task payload before you upload it to S3/IPFS/Arweave.

## Security Notes

Do not pass arbitrary user prompts straight into a privileged OpenClaw runtime. Add an AWS-side policy gate before OpenClaw:

- allowed task schemas
- allowed skills
- max runtime and spend
- domain allowlists
- no credential exfiltration paths
- human approval for irreversible actions

The current MVP proves invocation, discovery, escrow, and completion. Correctness of real-world task execution still needs off-chain verification, TEE attestation, oracle checks, user acceptance, or dispute handling.

## GitHub Save Flow

From the repo root:

```sh
git status
git add aws-cloud-agent-tuning/solana-agent-invocation aws-cloud-agent-tuning/README.md
git commit -m "Add Solana invocation MVP for AWS OpenClaw"
git push
```
