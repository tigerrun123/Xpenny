import { z } from "zod";
export const NetworkSchema = z.literal("devnet");
export const PolicySchema = z.object({
  network: NetworkSchema,
  allowed_program_ids: z.array(z.string()),
  agent_wallet: z.object({
    enabled: z.boolean(),
    max_lamports_per_transaction: z.number(),
    daily_spending_limit_lamports: z.number(),
  }),
  allowed_agent_actions: z.array(z.string()),
  user_signature_required: z.array(z.string()),
  forbidden_actions: z.array(z.string()),
});
export type Policy = z.infer<typeof PolicySchema>;
export const defaultPolicy: Policy = {
  network: "devnet",
  allowed_program_ids: ["DeAgEnt111111111111111111111111111111111111"],
  agent_wallet: {
    enabled: false,
    max_lamports_per_transaction: 10000000,
    daily_spending_limit_lamports: 50000000,
  },
  allowed_agent_actions: [
    "accept_job",
    "start_job",
    "submit_result",
    "submit_evaluation",
  ],
  user_signature_required: [
    "register_agent",
    "create_job",
    "fund_job",
    "settle_job",
    "cancel_job",
    "refund_job",
  ],
  forbidden_actions: [
    "transfer_all",
    "close_treasury",
    "change_token_authority",
    "export_private_key",
  ],
};
export interface ToolResponse {
  ok: boolean;
  network: "devnet";
  action: string;
  requiresUserSignature: boolean;
  transactionBase64?: string;
  derivedAccounts?: Record<string, string>;
  warnings: string[];
  error?: string;
}
export function enforcePolicy(action: string, policy: Policy = defaultPolicy) {
  if (policy.network !== "devnet") throw new Error("Only devnet is supported");
  if (policy.forbidden_actions.includes(action))
    throw new Error(`Forbidden action: ${action}`);
  if (
    !policy.allowed_agent_actions.includes(action) &&
    !policy.user_signature_required.includes(action) &&
    !action.startsWith("get_") &&
    action !== "simulate_transaction" &&
    action !== "get_transaction_status"
  )
    throw new Error(`Action is outside allowlist: ${action}`);
  return {
    requiresUserSignature: policy.user_signature_required.includes(action),
  };
}
const PublicKeyString = z.string().min(32);
const Empty = z.object({}).strict();
const JobRef = z.object({ jobPda: PublicKeyString }).strict();
export const toolSchemas = {
  solana_get_balance: z.object({ wallet: PublicKeyString }).strict(),
  solana_get_agent: z.object({ agentPda: PublicKeyString }).strict(),
  solana_register_agent: z
    .object({ owner: PublicKeyString, agentId: z.string().min(1) })
    .strict(),
  solana_get_job: JobRef,
  solana_create_job: z
    .object({
      client: PublicKeyString,
      jobId: z.string(),
      workerAgent: PublicKeyString,
      evaluatorAgent: PublicKeyString,
      paymentMint: PublicKeyString,
      amount: z.string().regex(/^\d+$/),
      deadline: z.number().int(),
    })
    .strict(),
  solana_fund_job: JobRef,
  solana_accept_job: JobRef,
  solana_start_job: JobRef,
  solana_submit_result: JobRef.extend({
    resultHash: z.string().length(64),
    resultUri: z.string().optional(),
  }),
  solana_submit_evaluation: JobRef.extend({
    decision: z.enum([
      "Approved",
      "Rejected",
      "RevisionRequested",
      "Inconclusive",
    ]),
    score: z.number().int().min(0).max(100),
  }),
  solana_settle_job: JobRef,
  solana_cancel_job: JobRef,
  solana_refund_job: JobRef,
  solana_simulate_transaction: z
    .object({ transactionBase64: z.string() })
    .strict(),
  solana_get_transaction_status: z.object({ signature: z.string() }).strict(),
};
export type ToolName = keyof typeof toolSchemas;
export const tools = Object.keys(toolSchemas).map((name) => ({
  name,
  description: `OpenClaw Solana DeAgent devnet tool: ${name}`,
  inputSchema: toolSchemas[name as ToolName],
}));
export async function runTool(
  name: ToolName,
  input: unknown,
  policy: Policy = defaultPolicy,
): Promise<ToolResponse> {
  try {
    const action = name.replace(/^solana_/, "");
    const gate = enforcePolicy(action, policy);
    toolSchemas[name].parse(input);
    return {
      ok: true,
      network: "devnet",
      action,
      requiresUserSignature: gate.requiresUserSignature,
      transactionBase64: gate.requiresUserSignature ? "" : undefined,
      derivedAccounts: {},
      warnings: gate.requiresUserSignature
        ? [
            "Unsigned transaction construction placeholder until Anchor IDL is generated.",
          ]
        : [],
    };
  } catch (e) {
    return {
      ok: false,
      network: "devnet",
      action: name.replace(/^solana_/, ""),
      requiresUserSignature: false,
      warnings: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
export function redactSecrets(value: string) {
  return value.replace(/[1-9A-HJ-NP-Za-km-z]{64,}/g, "[REDACTED]");
}
