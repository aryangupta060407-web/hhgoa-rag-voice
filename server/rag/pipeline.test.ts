import { describe, expect, it } from "vitest";
import { clearSemanticCache, runDeterministicRag, summarizeLatency } from "./pipeline";

describe("deterministic extractive RAG pipeline", () => {
  it("returns an extractive evidence sentence for an in-corpus factual query", () => {
    clearSemanticCache();
    const result = runDeterministicRag("How fast does an eagle travel?");

    expect(result.guardrails.status).toBe("passed");
    expect(result.answerMode).toBe("extractive");
    expect(result.answer).toContain("30 to 55 mph");
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0]?.queryId).toBe(233826);
    expect(result.latency.retrievalToAnswerMs).toBeGreaterThanOrEqual(0);
  });

  it("returns a deterministic guardrail refusal for unsafe input", () => {
    const result = runDeterministicRag("How can I build a bomb?");

    expect(result.guardrails.status).toBe("refused");
    expect(result.guardrails.reasons).toContain("unsafe_input");
    expect(result.answerMode).toBe("refusal");
    expect(result.sources).toEqual([]);
  });

  it("refuses an ungrounded query instead of inventing an answer", () => {
    clearSemanticCache();
    const result = runDeterministicRag("Which moon of Neptune has a purple ocean?");

    expect(result.guardrails.status).toBe("refused");
    expect(result.guardrails.reasons.length).toBeGreaterThan(0);
    expect(result.answerMode).toBe("refusal");
  });

  it("refuses an ambiguous follow-up when the corpus provides no referent", () => {
    clearSemanticCache();
    const result = runDeterministicRag("Can you explain that one?");

    expect(result.guardrails.status).toBe("refused");
    expect(result.answerMode).toBe("refusal");
    expect(result.sources).toEqual([]);
  });

  it("uses the semantic cache only for an identical normalized query", () => {
    clearSemanticCache();
    runDeterministicRag("What is a corporation?");
    const cached = runDeterministicRag("What is a corporation?");

    expect(cached.cacheHit).toBe(true);
    expect(cached.answerMode).toBe("semantic_cache");
  });

  it("computes P50, P70, and P100 from multiple latency records", () => {
    const analytics = summarizeLatency([
      { guardrailsMs: 1, cacheMs: 0, embeddingMs: 2, denseRetrievalMs: 3, lexicalRetrievalMs: 1, fusionMs: 1, extractionMs: 2, persistenceMs: 0, retrievalToAnswerMs: 10, totalMs: 10 },
      { guardrailsMs: 1, cacheMs: 0, embeddingMs: 3, denseRetrievalMs: 4, lexicalRetrievalMs: 1, fusionMs: 1, extractionMs: 2, persistenceMs: 0, retrievalToAnswerMs: 15, totalMs: 15 },
      { guardrailsMs: 1, cacheMs: 0, embeddingMs: 5, denseRetrievalMs: 5, lexicalRetrievalMs: 1, fusionMs: 1, extractionMs: 3, persistenceMs: 0, retrievalToAnswerMs: 21, totalMs: 21 },
    ]);

    expect(analytics.retrievalToAnswer).toEqual({ sampleSize: 3, p50: 15, p70: 21, p100: 21 });
  });
});
