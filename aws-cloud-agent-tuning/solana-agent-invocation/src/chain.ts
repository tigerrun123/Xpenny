import * as anchor from "@coral-xyz/anchor";
import { Program, BN, Idl } from "@coral-xyz/anchor";
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram
} from "@solana/web3.js";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPENCLAW_INVOCATION_IDL } from "./idl.js";

export type OpenClawProgram = Program<Idl>;

export function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function connection(): Connection {
  const commitment = (process.env.SOLANA_COMMITMENT ?? "confirmed") as Commitment;
  return new Connection(env("SOLANA_RPC_URL", "https://api.devnet.solana.com"), commitment);
}

export function readKeypair(filePath: string): Keypair {
  const resolved = filePath.startsWith("~")
    ? path.join(os.homedir(), filePath.slice(1))
    : filePath;
  const secret = JSON.parse(fs.readFileSync(resolved, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function programId(): PublicKey {
  return new PublicKey(env("PROGRAM_ID", "5SfS5maRBYUE3sEnfRX4xjNzRpPNhXPEsQjboCVKb41e"));
}

export function programWithWallet(walletKeypair: Keypair): OpenClawProgram {
  const provider = new anchor.AnchorProvider(
    connection(),
    new anchor.Wallet(walletKeypair),
    { commitment: (process.env.SOLANA_COMMITMENT ?? "confirmed") as Commitment }
  );
  const idl = { ...OPENCLAW_INVOCATION_IDL, address: programId().toBase58() } as unknown as Idl;
  return new anchor.Program(idl, provider);
}

export function deriveAgentPda(owner: PublicKey, slug: string): PublicKey {
  const [agent] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner.toBuffer(), Buffer.from(slug)],
    programId()
  );
  return agent;
}

export function deriveInvocationPda(
  agent: PublicKey,
  requester: PublicKey,
  nonce: BN
): PublicKey {
  const nonceBytes = Buffer.alloc(8);
  nonceBytes.writeBigUInt64LE(BigInt(nonce.toString()));
  const [invocation] = PublicKey.findProgramAddressSync(
    [Buffer.from("invocation"), agent.toBuffer(), requester.toBuffer(), nonceBytes],
    programId()
  );
  return invocation;
}

export function sha256Bytes(input: string | Buffer): number[] {
  return [...crypto.createHash("sha256").update(input).digest()];
}

export function hashHexToBytes32(hashHex: string): number[] {
  const clean = hashHex.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("Expected a 32-byte hex string");
  }
  return [...Buffer.from(clean, "hex")];
}

export { BN, PublicKey, SystemProgram };
