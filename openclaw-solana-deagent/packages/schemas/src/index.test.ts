import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  canonicalSha256Hex,
  TaskSpecificationSchema,
} from "./index.js";
describe("canonical hashing and schemas", () => {
  it("sorts keys deterministically", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  it("hashes deterministically", () => {
    expect(canonicalSha256Hex({ b: 1, a: 2 })).toHaveLength(64);
  });
  it("validates task specification", () => {
    expect(
      TaskSpecificationSchema.safeParse({
        version: "1.0",
        taskType: "x",
        title: "t",
        description: "d",
        acceptanceCriteria: [
          { id: "a", description: "d", verificationMethod: "manual" },
        ],
        payment: {
          mint: "DEVNET_TOKEN_MINT_111111111111111111",
          amountBaseUnits: "1",
        },
        deadline: 1780000000,
      }).success,
    ).toBe(true);
  });
});
