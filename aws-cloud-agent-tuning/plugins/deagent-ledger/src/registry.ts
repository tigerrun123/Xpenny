import type {
  AgentRecord,
  GetAgentInput,
  RegisterAgentInput,
  RegisterAgentResult
} from "./types.js";
import { notImplemented, requireNonEmpty } from "./utils.js";

export async function registerAgent(input: RegisterAgentInput): Promise<RegisterAgentResult> {
  requireNonEmpty(input.agentId, "agentId");
  return notImplemented("registerAgent");
}

export async function getAgent(input: GetAgentInput): Promise<AgentRecord | null> {
  requireNonEmpty(input.agentId, "agentId");
  return notImplemented("getAgent");
}
