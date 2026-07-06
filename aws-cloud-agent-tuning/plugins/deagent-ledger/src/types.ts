export type LedgerCluster = "devnet";

export interface DeAgentLedgerConfig {
  cluster?: LedgerCluster;
  rpcUrl?: string;
  programId?: string;
}

export interface AgentReference {
  agentId: string;
}

export interface RegisterAgentInput extends AgentReference {
  owner?: string;
  metadataUri?: string;
  metadataHash?: string;
}

export interface RegisterAgentResult extends AgentReference {
  status: "registered";
  agentPda?: string;
  transactionSignature?: string;
}

export interface GetAgentInput extends AgentReference {
  owner?: string;
}

export interface AgentRecord extends AgentReference {
  owner?: string;
  agentPda?: string;
  metadataUri?: string;
  metadataHash?: string;
}

export interface CreateInvocationInput extends AgentReference {
  requester?: string;
  inputHash?: string;
  inputUri?: string;
  payload?: unknown;
}

export interface CreateInvocationResult extends AgentReference {
  invocationId: string;
  invocationPda?: string;
  status: "created";
  transactionSignature?: string;
}

export interface SubmitResultInput {
  invocationId: string;
  resultHash?: string;
  resultUri?: string;
  result?: unknown;
}

export interface SubmitResultResult {
  invocationId: string;
  status: "submitted";
  transactionSignature?: string;
}

export interface UpdateReputationInput extends AgentReference {
  invocationId?: string;
  delta?: number;
  reason?: string;
}

export interface UpdateReputationResult extends AgentReference {
  reputationPda?: string;
  status: "updated";
  transactionSignature?: string;
}
