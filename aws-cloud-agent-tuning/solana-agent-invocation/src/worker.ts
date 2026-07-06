import "dotenv/config";
import {
  BN,
  PublicKey,
  deriveAgentPda,
  env,
  programWithWallet,
  readKeypair,
  sha256Bytes
} from "./chain.js";

type InvocationAccount = {
  publicKey: PublicKey;
  account: {
    requester: PublicKey;
    inputHash: number[];
    inputUri: string;
    resultHash: number[] | null;
    resultUri: string;
    status: { pending?: Record<string, never>; completed?: Record<string, never>; cancelled?: Record<string, never> };
    nonce: BN;
  };
};

function isPending(status: InvocationAccount["account"]["status"]): boolean {
  return Object.prototype.hasOwnProperty.call(status, "pending");
}

async function fetchPayload(inputUri: string): Promise<unknown> {
  if (inputUri.startsWith("inline:")) {
    return JSON.parse(Buffer.from(inputUri.slice("inline:".length), "base64").toString("utf8"));
  }

  const response = await fetch(inputUri);
  if (!response.ok) {
    throw new Error(`Failed to fetch payload ${inputUri}: ${response.status}`);
  }
  return response.json();
}

async function runOpenClaw(payload: unknown): Promise<unknown> {
  const response = await fetch(env("OPENCLAW_TASK_URL"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "solana-invocation",
      payload
    })
  });

  if (!response.ok) {
    throw new Error(`OpenClaw task failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function resultUri(invocation: PublicKey): string {
  const base = process.env.RESULT_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/${invocation.toBase58()}.json` : `inline-result:${invocation.toBase58()}`;
}

const agentSigner = readKeypair(env("AGENT_SIGNER_KEYPAIR"));
const owner = process.env.AGENT_OWNER_PUBKEY
  ? new PublicKey(process.env.AGENT_OWNER_PUBKEY)
  : readKeypair(env("OWNER_KEYPAIR")).publicKey;
const slug = env("AGENT_SLUG", "lobster");
const program = programWithWallet(agentSigner);
const agent = deriveAgentPda(owner, slug);
const intervalMs = Number.parseInt(env("POLL_INTERVAL_MS", "5000"), 10);
const seen = new Set<string>();

console.log(`Watching ${agent.toBase58()} for pending OpenClaw invocations`);

async function tick(): Promise<void> {
  const invocations = await (program.account as any).invocation.all([
    {
      memcmp: {
        offset: 8,
        bytes: agent.toBase58()
      }
    }
  ]) as InvocationAccount[];

  for (const invocation of invocations) {
    const id = invocation.publicKey.toBase58();
    if (seen.has(id) || !isPending(invocation.account.status)) {
      continue;
    }

    seen.add(id);
    console.log(`Running invocation ${id}`);

    try {
      const payload = await fetchPayload(invocation.account.inputUri);
      const result = await runOpenClaw(payload);
      const serializedResult = JSON.stringify({
        invocation: id,
        result
      });
      const hash = sha256Bytes(serializedResult);
      const uri = resultUri(invocation.publicKey);

      const tx = await program.methods
        .completeInvocation(hash, uri)
        .accounts({
          invocation: invocation.publicKey,
          agent,
          agentSigner: agentSigner.publicKey,
          agentOwner: owner
        })
        .signers([agentSigner])
        .rpc();

      console.log(JSON.stringify({
        completed: id,
        tx,
        resultHash: Buffer.from(hash).toString("hex"),
        resultUri: uri
      }));
    } catch (error) {
      seen.delete(id);
      console.error(`Invocation ${id} failed`, error);
    }
  }
}

await tick();
setInterval(() => {
  tick().catch((error) => console.error("Worker tick failed", error));
}, intervalMs);
