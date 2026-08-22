import { describe, expect, it } from "vitest";
import { runBenchmarkSuite } from "./benchmark";

describe("deterministic benchmark suite", () => {
  it("requires factual evidence and refuses unsupported, adversarial, and personal cases", async () => {
    const report = await runBenchmarkSuite();

    expect(report.totals.total).toBe(12);
    expect(report.totals.expectedBehaviorFailed).toBe(0);
    expect(report.categories.find(category => category.category === "adversarial")?.expectedBehaviorPassed).toBe(1);
    expect(report.categories.find(category => category.category === "personal_guardrail")?.expectedBehaviorPassed).toBe(3);
  });
});
