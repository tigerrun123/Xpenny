import type {
  CreateInvocationInput,
  CreateInvocationResult,
  SubmitResultInput,
  SubmitResultResult
} from "./types.js";
import { notImplemented, requireNonEmpty } from "./utils.js";

export async function createInvocation(input: CreateInvocationInput): Promise<CreateInvocationResult> {
  requireNonEmpty(input.agentId, "agentId");
  return notImplemented("createInvocation");
}

export async function submitResult(input: SubmitResultInput): Promise<SubmitResultResult> {
  requireNonEmpty(input.invocationId, "invocationId");
  return notImplemented("submitResult");
}
