import { describe, expect, it } from "vitest";
import { deriveProtocolPda, explorerUrl, mapSolanaError } from "./index.js";
describe("sdk", () => {
  it("derives protocol PDA", () =>
    expect(deriveProtocolPda().toBase58()).toBeTruthy());
  it("builds devnet explorer urls", () =>
    expect(explorerUrl("abc")).toContain("cluster=devnet"));
  it("maps errors", () =>
    expect(mapSolanaError(new Error("Blockhash not found")).message).toContain(
      "blockhash",
    ));
});
