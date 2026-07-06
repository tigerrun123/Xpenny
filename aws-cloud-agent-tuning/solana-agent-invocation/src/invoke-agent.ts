import "dotenv/config";
import { BN, SystemProgram, deriveAgentPda, deriveInvocationPda, env, programWithWallet, readKeypair, sha256Bytes } from "./chain.js";

function arg(name: string, fallback?: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback ?? "";
}

const requester = readKeypair(env("REQUESTER_KEYPAIR", env("OWNER_KEYPAIR")));
const ownerPubkey = readKeypair(env("OWNER_KEYPAIR")).publicKey;
const slug = arg("slug", env("AGENT_SLUG", "lobster"));
const inputUri = arg("input-uri", "");
const inputJson = arg("input-json", "");
const nonce = new BN(arg("nonce", Date.now().toString()));

if (!inputUri && !inputJson) {
  throw new Error("Pass --input-uri=https://... or --input-json='{\"task\":\"...\"}'");
}

const inputMaterial = inputJson || inputUri;
const inputHash = sha256Bytes(inputMaterial);
const program = programWithWallet(requester);
const agent = deriveAgentPda(ownerPubkey, slug);
const invocation = deriveInvocationPda(agent, requester.publicKey, nonce);

const tx = await program.methods
  .createInvocation(nonce, inputHash, inputUri || `inline:${Buffer.from(inputJson).toString("base64")}`)
  .accounts({
    agent,
    invocation,
    requester: requester.publicKey,
    systemProgram: SystemProgram.programId
  })
  .signers([requester])
  .rpc();

console.log(JSON.stringify({
  tx,
  agent: agent.toBase58(),
  invocation: invocation.toBase58(),
  requester: requester.publicKey.toBase58(),
  nonce: nonce.toString(),
  inputHash: Buffer.from(inputHash).toString("hex")
}, null, 2));
