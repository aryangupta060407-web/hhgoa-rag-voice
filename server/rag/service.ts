import { getRetrievalGatewayConfig, retrieveFromGateway, type RetrievalGatewayConfig } from "./retrievalGateway";
import { isUnsafeQuery, normalizeQuery, runDeterministicRag, tokenize } from "./pipeline";
import type { RagOutcome, RetrievedSource, StageLatency } from "./types";

type ServiceOptions = {
  gatewayConfig?: RetrievalGatewayConfig | null;
  fetchImpl?: typeof fetch;
};

const NO_CONTEXT_RESPONSE = "I couldn't find enough relevant information in the provided dataset to answer this question.";

function elapsed(start: number) {
  return Number((performance.now() - start).toFixed(3));
}

function emptyLatency(): StageLatency {
  return { guardrailsMs: 0, cacheMs: 0, embeddingMs: 0, denseRetrievalMs: 0, lexicalRetrievalMs: 0, fusionMs: 0, extractionMs: 0, persistenceMs: 0, retrievalToAnswerMs: 0, totalMs: 0 };
}

function bestGroundedSentence(content: string, query: string) {
  const queryTokens = tokenize(query);
  const sentences = content.match(/[^.!?]+[.!?]?/g)?.map(sentence => sentence.trim()).filter(Boolean) ?? [content];
  const scored = sentences.map(sentence => {
    const sentenceTokens = new Set(tokenize(sentence));
    const coverage = queryTokens.length ? queryTokens.filter(token => sentenceTokens.has(token)).length / queryTokens.length : 0;
    return { sentence, coverage };
  }).sort((left, right) => right.coverage - left.coverage);
  return scored[0] ?? { sentence: "", coverage: 0 };
}

function refusal(query: string, latency: StageLatency, reason: "unsafe_input" | "off_topic" | "insufficient_grounding", message = NO_CONTEXT_RESPONSE): RagOutcome {
  return {
    transcript: query,
    normalizedQuery: query,
    answer: message,
    answerMode: "refusal",
    sources: [],
    guardrails: { status: "refused", reasons: [reason], domainAffinity: 0, groundingConfidence: 0 },
    latency,
    cacheHit: false,
    corpusMode: "external_gateway",
  };
}

async function runExternalGatewayQuery(rawQuery: string, config: RetrievalGatewayConfig, fetchImpl?: typeof fetch): Promise<RagOutcome> {
  const started = performance.now();
  const query = normalizeQuery(rawQuery);
  const latency = emptyLatency();
  const guardrailStart = performance.now();
  if (isUnsafeQuery(query)) {
    latency.guardrailsMs = elapsed(guardrailStart);
    latency.retrievalToAnswerMs = elapsed(started);
    latency.totalMs = latency.retrievalToAnswerMs;
    return refusal(query, latency, "unsafe_input", "I cannot help with that request.");
  }
  latency.guardrailsMs = elapsed(guardrailStart);

  try {
    const gateway = await retrieveFromGateway({ query, language: "auto", limit: 3, minGroundingScore: 0.16 }, config, fetchImpl);
    latency.embeddingMs = gateway.timings.queryEmbeddingMs;
    latency.denseRetrievalMs = gateway.timings.denseSearchMs;
    latency.lexicalRetrievalMs = gateway.timings.sparseSearchMs;
    latency.fusionMs = gateway.timings.fusionMs;

    const extractionStarted = performance.now();
    const selected = gateway.matches.map(match => ({ match, extracted: bestGroundedSentence(match.content, query) }));
    const best = selected.sort((left, right) => right.extracted.coverage - left.extracted.coverage || right.match.rrfScore - left.match.rrfScore)[0];
    latency.extractionMs = elapsed(extractionStarted);

    if (!best || best.extracted.coverage < 0.12 || !best.extracted.sentence || !best.match.content.includes(best.extracted.sentence)) {
      latency.retrievalToAnswerMs = elapsed(started);
      latency.totalMs = latency.retrievalToAnswerMs;
      return refusal(query, latency, "insufficient_grounding");
    }

    const sources: RetrievedSource[] = selected.map(({ match, extracted }) => ({
      id: match.id,
      strategy: match.strategy as RetrievedSource["strategy"],
      queryId: match.source.queryId ?? 0,
      language: match.language,
      relevance: Number(match.rrfScore.toFixed(3)),
      content: match.content,
      evidenceSentence: extracted.sentence,
      dataset: match.source.dataset,
      split: match.source.split,
    }));
    const groundingConfidence = Number(Math.min(1, best.extracted.coverage * 0.75 + Math.min(1, best.match.rrfScore * 30) * 0.25).toFixed(3));
    latency.retrievalToAnswerMs = elapsed(started);
    latency.totalMs = latency.retrievalToAnswerMs;

    return {
      transcript: query,
      normalizedQuery: query,
      answer: best.extracted.sentence,
      answerMode: "extractive",
      sources,
      guardrails: { status: "passed", reasons: [], domainAffinity: best.extracted.coverage, groundingConfidence },
      latency,
      cacheHit: false,
      corpusMode: "external_gateway",
      indexVersion: gateway.indexVersion,
    };
  } catch (error) {
    console.error("[RAG] External retrieval gateway failed", error);
    latency.retrievalToAnswerMs = elapsed(started);
    latency.totalMs = latency.retrievalToAnswerMs;
    return refusal(query, latency, "insufficient_grounding", "The full corpus retrieval service is temporarily unavailable. Please try again shortly.");
  }
}

/**
 * Uses the full-corpus gateway only when both server-only credentials are
 * configured. Until then, the verified compact deterministic demonstration
 * remains active and makes no remote model or retrieval call.
 */
export async function runRagQuery(query: string, options: ServiceOptions = {}): Promise<RagOutcome> {
  const config = options.gatewayConfig === undefined ? getRetrievalGatewayConfig() : options.gatewayConfig;
  if (!config) {
    return { ...runDeterministicRag(query), corpusMode: "compact_local", indexVersion: "compact-validation-slice" };
  }
  return runExternalGatewayQuery(query, config, options.fetchImpl);
}
