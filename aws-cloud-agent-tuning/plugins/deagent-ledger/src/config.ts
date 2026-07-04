import type { DeAgentLedgerConfig, LedgerCluster } from "./types.js";

export const DEFAULT_CLUSTER: LedgerCluster = "devnet";
export const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";

export interface ResolvedDeAgentLedgerConfig {
  cluster: LedgerCluster;
  rpcUrl: string;
  programId?: string;
}

export function resolveConfig(config: DeAgentLedgerConfig = {}): ResolvedDeAgentLedgerConfig {
  return {
    cluster: config.cluster ?? DEFAULT_CLUSTER,
    rpcUrl: config.rpcUrl ?? DEFAULT_DEVNET_RPC_URL,
    programId: config.programId
  };
}
