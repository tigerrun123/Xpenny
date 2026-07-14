import {
  PublicKey,
  Connection,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { z } from "zod";
export const DEFAULT_PROGRAM_ID = new PublicKey(
  "DeAgEnt111111111111111111111111111111111111",
);
export type Network = "devnet";
export interface SdkContext {
  connection: Connection;
  programId?: PublicKey;
  network: Network;
}
export interface TxResult {
  signature: string;
  explorerUrl: string;
}
export interface UnsignedTxResult {
  transactionBase64: string;
  requiresUserSignature: true;
  derivedAccounts: Record<string, string>;
  warnings: string[];
}
const str = z.string().min(1);
export const JobInputSchema = z.object({
  client: z.string(),
  jobId: str,
  workerAgent: z.string(),
  evaluatorAgent: z.string(),
  paymentMint: z.string(),
  amount: z.string().regex(/^\d+$/),
  deadline: z.number().int(),
});
function pid(programId?: PublicKey) {
  return programId ?? DEFAULT_PROGRAM_ID;
}
function pda(seeds: (Buffer | Uint8Array)[], programId?: PublicKey) {
  return PublicKey.findProgramAddressSync(seeds, pid(programId));
}
export function deriveProtocolPda(programId?: PublicKey) {
  return pda([Buffer.from("protocol")], programId)[0];
}
export function deriveAgentPda(
  owner: PublicKey,
  agentId: string,
  programId?: PublicKey,
) {
  return pda(
    [Buffer.from("agent"), owner.toBuffer(), Buffer.from(agentId)],
    programId,
  )[0];
}
export function deriveJobPda(
  client: PublicKey,
  jobId: string,
  programId?: PublicKey,
) {
  return pda(
    [Buffer.from("job"), client.toBuffer(), Buffer.from(jobId)],
    programId,
  )[0];
}
export function deriveEvaluationPda(
  job: PublicKey,
  evaluator: PublicKey,
  programId?: PublicKey,
) {
  return pda(
    [Buffer.from("evaluation"), job.toBuffer(), evaluator.toBuffer()],
    programId,
  )[0];
}
export function deriveEscrowAuthorityPda(
  job: PublicKey,
  programId?: PublicKey,
) {
  return pda([Buffer.from("escrow"), job.toBuffer()], programId)[0];
}
export function explorerUrl(
  signatureOrAddress: string,
  cluster: Network = "devnet",
) {
  return `https://explorer.solana.com/tx/${signatureOrAddress}?cluster=${cluster}`;
}
export async function buildUnsignedTransaction(
  _ctx: SdkContext,
  derivedAccounts: Record<string, string> = {},
): Promise<UnsignedTxResult> {
  const tx = new Transaction();
  return {
    transactionBase64: tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64"),
    requiresUserSignature: true,
    derivedAccounts,
    warnings: [
      "MVP transaction builder: attach Anchor instructions after IDL generation.",
    ],
  };
}
export async function sendSignedTransaction(
  ctx: SdkContext,
  transactionBase64: string,
): Promise<TxResult> {
  const raw = Buffer.from(transactionBase64, "base64");
  let sig: string;
  try {
    sig = await ctx.connection.sendRawTransaction(raw, {
      skipPreflight: false,
    });
  } catch (e) {
    throw mapSolanaError(e);
  }
  return { signature: sig, explorerUrl: explorerUrl(sig, ctx.network) };
}
export async function simulateTransaction(
  ctx: SdkContext,
  transactionBase64: string,
) {
  const tx = VersionedTransaction.deserialize(
    Buffer.from(transactionBase64, "base64"),
  );
  return ctx.connection.simulateTransaction(tx);
}
export function mapSolanaError(error: unknown): Error {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("custom program error"))
    return new Error(`DeAgent program rejected transaction: ${msg}`);
  if (msg.includes("Blockhash"))
    return new Error(`Recent blockhash expired: ${msg}`);
  return new Error(msg);
}
async function placeholder(
  name: string,
  accounts: Record<string, string> = {},
): Promise<UnsignedTxResult> {
  return {
    transactionBase64: "",
    requiresUserSignature: true,
    derivedAccounts: accounts,
    warnings: [`${name} requires generated Anchor IDL before live submission.`],
  };
}
export const initializeProtocol = (ctx: SdkContext) =>
  placeholder("initializeProtocol", {
    protocolPda: deriveProtocolPda(ctx.programId).toBase58(),
  });
export const registerAgent = (
  ctx: SdkContext,
  input: { owner: string; agentId: string },
) =>
  placeholder("registerAgent", {
    agentPda: deriveAgentPda(
      new PublicKey(input.owner),
      input.agentId,
      ctx.programId,
    ).toBase58(),
  });
export const fetchAgent = async () => null;
export const createJob = (ctx: SdkContext, input: unknown) => {
  const i = JobInputSchema.parse(input);
  const client = new PublicKey(i.client);
  const job = deriveJobPda(client, i.jobId, ctx.programId);
  return placeholder("createJob", {
    jobPda: job.toBase58(),
    escrowAuthorityPda: deriveEscrowAuthorityPda(job, ctx.programId).toBase58(),
  });
};
export const fundJob = placeholder;
export const fetchJob = async () => null;
export const acceptJob = placeholder;
export const startJob = placeholder;
export const submitResult = placeholder;
export const submitEvaluation = placeholder;
export const settleJob = placeholder;
export const cancelJob = placeholder;
export const refundJob = placeholder;
