import type { ResolvedDeAgentLedgerConfig } from "./config.js";

export interface AnchorAdapter {
  config: ResolvedDeAgentLedgerConfig;
}

export function createAnchorAdapter(config: ResolvedDeAgentLedgerConfig): AnchorAdapter {
  return { config };
}
