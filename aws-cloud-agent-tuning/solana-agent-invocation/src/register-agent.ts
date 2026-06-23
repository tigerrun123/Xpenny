import "dotenv/config";
import {
  BN,
  PublicKey,
  SystemProgram,
  deriveAgentPda,
  env,
  hashHexToBytes32,
  programWithWallet,
  readKeypair
} from "./chain.js";

const owner = readKeypair(env("OWNER_KEYPAIR"));
const agentSigner = readKeypair(env("AGENT_SIGNER_KEYPAIR"));
const slug = env("AGENT_SLUG", "lobster");
const manifestUri = env("AGENT_MANIFEST_URI");
const manifestHash = hashHexToBytes32(env("AGENT_MANIFEST_HASH"));
const priceLamports = new BN(env("AGENT_PRICE_LAMPORTS", "0"));
const program = programWithWallet(owner);
const agent = deriveAgentPda(owner.publicKey, slug);

const tx = await program.methods
  .registerAgent(slug, manifestUri, manifestHash, agentSigner.publicKey, priceLamports)
  .accounts({
    agent,
    owner: owner.publicKey,
    systemProgram: SystemProgram.programId
  })
  .signers([owner])
  .rpc();

console.log(JSON.stringify({
  tx,
  agent: agent.toBase58(),
  owner: owner.publicKey.toBase58(),
  agentSigner: agentSigner.publicKey.toBase58(),
  manifestUri,
  priceLamports: priceLamports.toString()
}, null, 2));
