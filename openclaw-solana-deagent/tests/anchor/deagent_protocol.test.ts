import { describe, it } from "vitest";
describe("Anchor DeAgent protocol scenarios", () => {
  for (const name of [
    "Protocol initialization",
    "Agent registration",
    "Duplicate agent rejection",
    "Job creation",
    "Job funding",
    "Incorrect funder rejection",
    "Incorrect mint rejection",
    "Worker acceptance",
    "Wrong worker rejection",
    "Result submission",
    "Wrong evaluator rejection",
    "Evaluation approval",
    "Successful settlement",
    "Double settlement rejection",
    "Cancellation before acceptance",
    "Refund",
    "Double refund rejection",
    "Invalid state transition rejection",
    "Deadline-related behaviour",
    "Arbitrary destination rejection",
  ]) {
    it.todo(name);
  }
});
