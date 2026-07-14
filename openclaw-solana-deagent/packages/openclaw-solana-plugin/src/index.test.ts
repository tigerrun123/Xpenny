import { describe, expect, it } from "vitest";
import { enforcePolicy, runTool } from "./index.js";
describe("plugin policy and validation", () => {
  it("rejects forbidden actions", () =>
    expect(() => enforcePolicy("export_private_key")).toThrow());
  it("requires user signature for create_job", () =>
    expect(enforcePolicy("create_job").requiresUserSignature).toBe(true));
  it("validates tool input", async () =>
    expect((await runTool("solana_create_job", {})).ok).toBe(false));
});
