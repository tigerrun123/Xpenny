import { createInvocation, submitResult } from "./invocation.js";
import { updateReputation } from "./reputation.js";
import { getAgent, registerAgent } from "./registry.js";

export {
  DEFAULT_CLUSTER,
  DEFAULT_DEVNET_RPC_URL,
  resolveConfig
} from "./config.js";
export { createAnchorAdapter } from "./anchor.js";
export { registerAgent, getAgent } from "./registry.js";
export { createInvocation, submitResult } from "./invocation.js";
export { updateReputation } from "./reputation.js";

export function activate() {
  return {
    id: "deagent-ledger",
    api: {
      registerAgent,
      getAgent,
      createInvocation,
      submitResult,
      updateReputation
    }
  };
}

export function register() {
  return activate();
}

export type {
  AgentRecord,
  AgentReference,
  CreateInvocationInput,
  CreateInvocationResult,
  DeAgentLedgerConfig,
  GetAgentInput,
  LedgerCluster,
  RegisterAgentInput,
  RegisterAgentResult,
  SubmitResultInput,
  SubmitResultResult,
  UpdateReputationInput,
  UpdateReputationResult
} from "./types.js";
