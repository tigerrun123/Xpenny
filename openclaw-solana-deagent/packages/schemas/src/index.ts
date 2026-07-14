import { createHash } from "node:crypto";
import { z } from "zod";
export const AcceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  verificationMethod: z.string().min(1),
});
export const PaymentSchema = z.object({
  mint: z.string().min(32),
  amountBaseUnits: z.string().regex(/^\d+$/),
});
export const TaskSpecificationSchema = z.object({
  version: z.literal("1.0"),
  taskType: z.string(),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  payment: PaymentSchema,
  deadline: z.number().int().positive(),
});
export const EvidenceItemSchema = z.object({
  id: z.string(),
  uri: z.string(),
  sha256: z.string().length(64),
  mimeType: z.string().optional(),
});
export const ResultManifestSchema = z.object({
  version: z.literal("1.0"),
  jobId: z.string(),
  summary: z.string(),
  evidence: z.array(EvidenceItemSchema),
  createdAt: z.string(),
});
export const EvaluationReportSchema = z.object({
  version: z.literal("1.0"),
  jobId: z.string(),
  decision: z.enum([
    "Approved",
    "Rejected",
    "RevisionRequested",
    "Inconclusive",
  ]),
  score: z.number().int().min(0).max(100),
  evidenceRoot: z.string().length(64),
  summary: z.string(),
});
export const AgentCardSchema = z.object({
  version: z.literal("1.0"),
  agentId: z.string(),
  name: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()),
  metadataUri: z.string().optional(),
});
export type TaskSpecification = z.infer<typeof TaskSpecificationSchema>;
export type AgentCard = z.infer<typeof AgentCardSchema>;
export function canonicalJson(value: unknown): string {
  function sort(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, val]) => [k, sort(val)]),
      );
    }
    return v;
  }
  return JSON.stringify(sort(value));
}
export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
export function canonicalSha256Hex(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
export function hexToBytes32(hex: string): number[] {
  if (!/^[0-9a-fA-F]{64}$/.test(hex))
    throw new Error("Expected 32-byte hex string");
  return Array.from(Buffer.from(hex, "hex"));
}
