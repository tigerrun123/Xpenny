import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram
} from "@solana/web3.js";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_PROGRAM_ID = "5SfS5maRBYUE3sEnfRX4xjNzRpPNhXPEsQjboCVKb41e";
const DEFAULT_COMMITMENT = "confirmed";
const MAX_U64 = (1n << 64n) - 1n;

const OPENCLAW_INVOCATION_IDL = {
  address: DEFAULT_PROGRAM_ID,
  metadata: {
    name: "openclaw_invocation",
    version: "0.1.0",
    spec: "0.1.0"
  },
  version: "0.1.0",
  name: "openclaw_invocation",
  instructions: [
    {
      name: "registerAgent",
      discriminator: [135, 157, 66, 195, 2, 113, 175, 30],
      accounts: [
        { name: "agent", writable: true, signer: false },
        { name: "owner", writable: true, signer: true },
        { name: "systemProgram", writable: false, signer: false }
      ],
      args: [
        { name: "slug", type: "string" },
        { name: "manifestUri", type: "string" },
        { name: "manifestHash", type: { array: ["u8", 32] } },
        { name: "agentSigner", type: "pubkey" },
        { name: "priceLamports", type: "u64" }
      ]
    },
    {
      name: "createInvocation",
      discriminator: [116, 23, 146, 191, 178, 68, 64, 65],
      accounts: [
        { name: "agent", writable: true, signer: false },
        { name: "invocation", writable: true, signer: false },
        { name: "requester", writable: true, signer: true },
        { name: "systemProgram", writable: false, signer: false }
      ],
      args: [
        { name: "nonce", type: "u64" },
        { name: "inputHash", type: { array: ["u8", 32] } },
        { name: "inputUri", type: "string" }
      ]
    },
    {
      name: "completeInvocation",
      discriminator: [232, 203, 13, 30, 135, 199, 88, 0],
      accounts: [
        { name: "invocation", writable: true, signer: false },
        { name: "agent", writable: false, signer: false },
        { name: "agentSigner", writable: false, signer: true },
        { name: "agentOwner", writable: true, signer: false }
      ],
      args: [
        { name: "resultHash", type: { array: ["u8", 32] } },
        { name: "resultUri", type: "string" }
      ]
    }
  ],
  accounts: [
    {
      name: "Agent",
      discriminator: [47, 166, 112, 147, 155, 197, 86, 7]
    },
    {
      name: "Invocation",
      discriminator: [206, 201, 229, 132, 106, 251, 110, 191]
    }
  ],
  types: [
    {
      name: "Agent",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "agentSigner", type: "pubkey" },
          { name: "slug", type: "string" },
          { name: "manifestUri", type: "string" },
          { name: "manifestHash", type: { array: ["u8", 32] } },
          { name: "priceLamports", type: "u64" },
          { name: "active", type: "bool" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "Invocation",
      type: {
        kind: "struct",
        fields: [
          { name: "agent", type: "pubkey" },
          { name: "requester", type: "pubkey" },
          { name: "inputHash", type: { array: ["u8", 32] } },
          { name: "inputUri", type: "string" },
          { name: "resultHash", type: { option: { array: ["u8", 32] } } },
          { name: "resultUri", type: "string" },
          { name: "status", type: { defined: "InvocationStatus" } },
          { name: "escrowLamports", type: "u64" },
          { name: "createdAt", type: "i64" },
          { name: "completedAt", type: { option: "i64" } },
          { name: "nonce", type: "u64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "InvocationStatus",
      type: {
        kind: "enum",
        variants: [{ name: "Pending" }, { name: "Completed" }, { name: "Cancelled" }]
      }
    }
  ]
};

function optionalEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function resolveHome(filePath) {
  if (!filePath) return "";
  return filePath.startsWith("~") ? path.join(os.homedir(), filePath.slice(1)) : filePath;
}

function readKeypair(filePath) {
  if (!filePath) throw new Error("Missing keypair path");
  const secret = JSON.parse(fs.readFileSync(resolveHome(filePath), "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function asPublicKey(value, fieldName = "publicKey") {
  if (value instanceof PublicKey) return value;
  if (typeof value === "string") return new PublicKey(value);
  throw new Error(`${fieldName} must be a PublicKey or base58 string`);
}

function asNonce(value) {
  const nonce = value === undefined || value === null ? BigInt(Date.now()) : BigInt(value);
  if (nonce < 0n || nonce > MAX_U64) throw new Error("nonce must fit in u64");
  return nonce;
}

function nonceBuffer(nonce) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(nonce);
  return buffer;
}

function bytes32(value, fieldName) {
  if (Array.isArray(value) && value.length === 32) return value;
  if (Buffer.isBuffer(value) && value.length === 32) return [...value];
  if (typeof value === "string") {
    const clean = value.replace(/^0x/, "");
    if (/^[0-9a-fA-F]{64}$/.test(clean)) return [...Buffer.from(clean, "hex")];
  }
  throw new Error(`${fieldName} must be a 32-byte hex string, Buffer, or byte array`);
}

function sha256Bytes(value) {
  const material = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(value);
  return [...crypto.createHash("sha256").update(material).digest()];
}

function inlineUri(prefix, value) {
  const material = typeof value === "string" ? value : JSON.stringify(value);
  return `${prefix}:${Buffer.from(material).toString("base64")}`;
}

function normalizeAccount(account) {
  if (!account) return null;
  return JSON.parse(JSON.stringify(account, (_key, value) => {
    if (value instanceof PublicKey) return value.toBase58();
    if (anchor.BN.isBN(value)) return value.toString();
    return value;
  }));
}

export function deriveAgentPda({ owner, slug, programId = optionalEnv("DEAGENT_LEDGER_PROGRAM_ID", DEFAULT_PROGRAM_ID) }) {
  const [agent] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), asPublicKey(owner, "owner").toBuffer(), Buffer.from(slug)],
    asPublicKey(programId, "programId")
  );
  return agent;
}

export function deriveInvocationPda({
  agent,
  requester,
  nonce,
  programId = optionalEnv("DEAGENT_LEDGER_PROGRAM_ID", DEFAULT_PROGRAM_ID)
}) {
  const [invocation] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("invocation"),
      asPublicKey(agent, "agent").toBuffer(),
      asPublicKey(requester, "requester").toBuffer(),
      nonceBuffer(asNonce(nonce))
    ],
    asPublicKey(programId, "programId")
  );
  return invocation;
}

export function deriveReputationPda({
  agent,
  programId = optionalEnv("DEAGENT_LEDGER_PROGRAM_ID", DEFAULT_PROGRAM_ID)
}) {
  const [reputation] = PublicKey.findProgramAddressSync(
    [Buffer.from("reputation"), asPublicKey(agent, "agent").toBuffer()],
    asPublicKey(programId, "programId")
  );
  return reputation;
}

export function createDeAgentLedger(options = {}) {
  const rpcUrl = options.rpcUrl || optionalEnv("SOLANA_RPC_URL", DEFAULT_RPC_URL);
  const cluster = options.cluster || optionalEnv("SOLANA_CLUSTER", "devnet");
  if (cluster !== "devnet" || rpcUrl.includes("mainnet")) {
    throw new Error("DeAgent Ledger phase 1 supports devnet only");
  }

  const commitment = options.commitment || optionalEnv("SOLANA_COMMITMENT", DEFAULT_COMMITMENT);
  const programId = asPublicKey(
    options.programId || optionalEnv("DEAGENT_LEDGER_PROGRAM_ID", DEFAULT_PROGRAM_ID),
    "programId"
  );
  const connection = options.connection || new Connection(rpcUrl, commitment);

  function programFor(keypair) {
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(keypair),
      { commitment }
    );
    return new anchor.Program({ ...OPENCLAW_INVOCATION_IDL, address: programId.toBase58() }, provider);
  }

  function ownerKeypair() {
    return options.ownerKeypair || readKeypair(options.ownerKeypairPath || optionalEnv("OWNER_KEYPAIR"));
  }

  function requesterKeypair() {
    const fallback = options.requesterKeypairPath || optionalEnv("REQUESTER_KEYPAIR") || optionalEnv("OWNER_KEYPAIR");
    return options.requesterKeypair || readKeypair(fallback);
  }

  function agentSignerKeypair() {
    return options.agentSignerKeypair || readKeypair(options.agentSignerKeypairPath || optionalEnv("AGENT_SIGNER_KEYPAIR"));
  }

  async function registerAgent({
    slug,
    manifestUri,
    manifestHash,
    agentSigner,
    priceLamports = 0
  }) {
    const owner = ownerKeypair();
    const signerPubkey = agentSigner ? asPublicKey(agentSigner, "agentSigner") : agentSignerKeypair().publicKey;
    const agent = deriveAgentPda({ owner: owner.publicKey, slug, programId });
    const program = programFor(owner);
    const price = new anchor.BN(priceLamports.toString());
    const tx = await program.methods
      .registerAgent(slug, manifestUri, bytes32(manifestHash, "manifestHash"), signerPubkey, price)
      .accounts({
        agent,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId
      })
      .signers([owner])
      .rpc();

    return {
      cluster,
      tx,
      agent: agent.toBase58(),
      owner: owner.publicKey.toBase58(),
      agentSigner: signerPubkey.toBase58(),
      priceLamports: price.toString()
    };
  }

  async function createInvocation({
    owner,
    slug,
    agent,
    requester,
    nonce,
    inputHash,
    inputUri,
    inputJson
  }) {
    const requesterWallet = requester ? null : requesterKeypair();
    const requesterPubkey = requester
      ? asPublicKey(requester, "requester")
      : requesterWallet.publicKey;
    const agentPda = agent
      ? asPublicKey(agent, "agent")
      : deriveAgentPda({ owner: asPublicKey(owner, "owner"), slug, programId });
    const invocationNonce = asNonce(nonce);
    const invocation = deriveInvocationPda({
      agent: agentPda,
      requester: requesterPubkey,
      nonce: invocationNonce,
      programId
    });
    const material = inputHash ? null : inputJson ?? inputUri;
    if (!inputHash && material === undefined) {
      throw new Error("createInvocation requires inputHash, inputUri, or inputJson");
    }
    if (requester) {
      throw new Error("createInvocation requires a local requester keypair for devnet transaction signing");
    }

    const hash = inputHash ? bytes32(inputHash, "inputHash") : sha256Bytes(material);
    const uri = inputUri || inlineUri("inline", inputJson ?? inputHash);
    const program = programFor(requesterWallet);
    const tx = await program.methods
      .createInvocation(new anchor.BN(invocationNonce.toString()), hash, uri)
      .accounts({
        agent: agentPda,
        invocation,
        requester: requesterPubkey,
        systemProgram: SystemProgram.programId
      })
      .signers([requesterWallet])
      .rpc();

    return {
      cluster,
      tx,
      agent: agentPda.toBase58(),
      invocation: invocation.toBase58(),
      requester: requesterPubkey.toBase58(),
      nonce: invocationNonce.toString(),
      inputHash: Buffer.from(hash).toString("hex")
    };
  }

  async function submitResult({
    invocation,
    agent,
    agentOwner,
    resultHash,
    resultUri,
    resultJson
  }) {
    const signer = agentSignerKeypair();
    const agentPda = asPublicKey(agent, "agent");
    const invocationPda = asPublicKey(invocation, "invocation");
    const agentAccount = await programFor(signer).account.agent.fetch(agentPda);
    const owner = agentOwner ? asPublicKey(agentOwner, "agentOwner") : agentAccount.owner;
    const material = resultHash ? null : resultJson ?? resultUri;
    if (!resultHash && material === undefined) {
      throw new Error("submitResult requires resultHash, resultUri, or resultJson");
    }

    const hash = resultHash ? bytes32(resultHash, "resultHash") : sha256Bytes(material);
    const uri = resultUri || inlineUri("inline-result", resultJson ?? resultHash);
    const program = programFor(signer);
    const tx = await program.methods
      .completeInvocation(hash, uri)
      .accounts({
        invocation: invocationPda,
        agent: agentPda,
        agentSigner: signer.publicKey,
        agentOwner: owner
      })
      .signers([signer])
      .rpc();

    return {
      cluster,
      tx,
      agent: agentPda.toBase58(),
      invocation: invocationPda.toBase58(),
      agentSigner: signer.publicKey.toBase58(),
      resultHash: Buffer.from(hash).toString("hex")
    };
  }

  async function readReputation({ agent }) {
    const agentPda = asPublicKey(agent, "agent");
    const reputation = deriveReputationPda({ agent: agentPda, programId });
    const accountInfo = await connection.getAccountInfo(reputation, commitment);
    return {
      cluster,
      agent: agentPda.toBase58(),
      reputation: reputation.toBase58(),
      exists: Boolean(accountInfo),
      score: 0,
      completedInvocations: 0,
      failedInvocations: 0,
      note: accountInfo
        ? "Reputation PDA exists, but phase 1 does not decode reputation state."
        : "Reputation PDA is reserved; no phase 1 account has been created."
    };
  }

  async function readAgent({ owner, slug, agent }) {
    const agentPda = agent
      ? asPublicKey(agent, "agent")
      : deriveAgentPda({ owner: asPublicKey(owner, "owner"), slug, programId });
    const account = await programFor(ownerKeypair()).account.agent.fetchNullable(agentPda);
    return {
      cluster,
      agent: agentPda.toBase58(),
      exists: Boolean(account),
      account: normalizeAccount(account)
    };
  }

  async function readInvocation({ invocation }) {
    const invocationPda = asPublicKey(invocation, "invocation");
    const account = await programFor(requesterKeypair()).account.invocation.fetchNullable(invocationPda);
    return {
      cluster,
      invocation: invocationPda.toBase58(),
      exists: Boolean(account),
      account: normalizeAccount(account)
    };
  }

  async function depositEscrow() {
    return {
      cluster,
      status: "not_implemented",
      phase: 2,
      message: "Escrow is reserved for phase 2; no token or SOL transfer was created."
    };
  }

  async function releasePayment() {
    return {
      cluster,
      status: "not_implemented",
      phase: 2,
      message: "Payment release is reserved for phase 2; no token or SOL transfer was created."
    };
  }

  return {
    cluster,
    connection,
    programId: () => programId.toBase58(),
    ownerPublicKey: () => ownerKeypair().publicKey.toBase58(),
    requesterPublicKey: () => requesterKeypair().publicKey.toBase58(),
    agentSignerPublicKey: () => agentSignerKeypair().publicKey.toBase58(),
    deriveAgentPda: (args) => deriveAgentPda({ ...args, programId }),
    deriveInvocationPda: (args) => deriveInvocationPda({ ...args, programId }),
    deriveReputationPda: (args) => deriveReputationPda({ ...args, programId }),
    registerAgent,
    createInvocation,
    submitResult,
    readReputation,
    readAgent,
    readInvocation,
    depositEscrow,
    releasePayment
  };
}

const defaultLedger = () => createDeAgentLedger();

export const registerAgent = (args) => defaultLedger().registerAgent(args);
export const createInvocation = (args) => defaultLedger().createInvocation(args);
export const submitResult = (args) => defaultLedger().submitResult(args);
export const readReputation = (args) => defaultLedger().readReputation(args);
export const depositEscrow = (args) => defaultLedger().depositEscrow(args);
export const releasePayment = (args) => defaultLedger().releasePayment(args);

export default {
  createDeAgentLedger,
  registerAgent,
  createInvocation,
  submitResult,
  readReputation,
  depositEscrow,
  releasePayment
};
