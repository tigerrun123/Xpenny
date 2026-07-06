import type {
  UpdateReputationInput,
  UpdateReputationResult
} from "./types.js";
import { notImplemented, requireNonEmpty } from "./utils.js";

export async function updateReputation(input: UpdateReputationInput): Promise<UpdateReputationResult> {
  requireNonEmpty(input.agentId, "agentId");
  return notImplemented("updateReputation");
}
