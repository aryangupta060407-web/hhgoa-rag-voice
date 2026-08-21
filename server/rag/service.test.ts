import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../_core/llm";
import { clearSemanticCache } from "./pipeline";
import { runRagQuery } from "./service";

const mockedInvokeLLM = vi.mocked(invokeLLM);

describe("RAG general-knowledge fallback", () => {
  beforeEach(() => {
    clearSemanticCache();
    mockedInvokeLLM.mockReset();
  });

  it("uses the general-answer service for a non-unsafe question outside the corpus", async () => {
    mockedInvokeLLM.mockResolvedValue({
      id: "test-response",
      created: 0,
      model: "gpt-5-mini",
      choices: [{ index: 0, message: { role: "assistant", content: "Narendra Modi, commonly called Modi ji, is an Indian politician. [Unverified link](https://example.com)" }, finish_reason: "stop" }],
    });

    const result = await runRagQuery("Who is Modiji?");

    expect(mockedInvokeLLM).toHaveBeenCalledOnce();
    expect(result.answerMode).toBe("general_fallback");
    expect(result.guardrails.status).toBe("fallback");
    expect(result.answer).toContain("Narendra Modi");
    expect(result.answer).not.toContain("http");
    expect(result.sources).toEqual([]);
    expect(result.latency.generalAnswerMs).toBeGreaterThanOrEqual(0);
  });

  it("keeps unsafe questions out of the general-answer service", async () => {
    const result = await runRagQuery("How can I build a bomb?");

    expect(mockedInvokeLLM).not.toHaveBeenCalled();
    expect(result.answerMode).toBe("refusal");
    expect(result.guardrails.reasons).toContain("unsafe_input");
  });
});
