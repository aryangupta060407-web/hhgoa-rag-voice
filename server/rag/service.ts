import { getRetrievalGatewayConfig, retrieveFromGateway, type RetrievalGatewayConfig } from "./retrievalGateway";
import { hasGroundableTerms, isUnsafeQuery, normalizeForRetrieval, normalizeQuery, runDeterministicRag, tokenize } from "./pipeline";
import type { RagOutcome, RetrievedSource, StageLatency } from "./types";

type ServiceOptions = {
  gatewayConfig?: RetrievalGatewayConfig | null;
  fetchImpl?: typeof fetch;
  language?: "auto" | "hi" | "en" | "mr";
};

const NO_CONTEXT_RESPONSE = "I couldn't find enough relevant information in the provided dataset to answer this question.";
const MIN_EXTRACTIVE_COVERAGE = 0.3;
const GENERIC_QUESTION_TERMS = new Set([
  "fast", "speed", "travel", "quick", "quickly", "long", "time", "times", "year", "years", "work", "works", "history",
  "meaning", "mean", "define", "definition", "effect", "effects", "cost", "costs", "price", "prices", "rate", "rates",
  "रफ्तार", "तेजी", "गति", "उड़ते",
]);

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

function hasSubjectAnchor(content: string, query: string) {
  const subjectAnchors = tokenize(query).filter(token => !GENERIC_QUESTION_TERMS.has(token));
  if (!subjectAnchors.length) return false;
  const contentTokens = new Set(tokenize(content));
  return subjectAnchors.some(anchor => contentTokens.has(anchor));
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

async function runExternalGatewayQuery(rawQuery: string, config: RetrievalGatewayConfig, language: "auto" | "hi" | "en" | "mr", fetchImpl?: typeof fetch): Promise<RagOutcome> {
  const started = performance.now();
  const query = normalizeQuery(rawQuery);
  const retrievalQuery = normalizeForRetrieval(query);
  const latency = emptyLatency();
  const guardrailStart = performance.now();
  if (isUnsafeQuery(query)) {
    latency.guardrailsMs = elapsed(guardrailStart);
    latency.retrievalToAnswerMs = elapsed(started);
    latency.totalMs = latency.retrievalToAnswerMs;
    return refusal(query, latency, "unsafe_input", "I cannot help with that request.");
  }
  if (!hasGroundableTerms(retrievalQuery)) {
    latency.guardrailsMs = elapsed(guardrailStart);
    latency.retrievalToAnswerMs = elapsed(started);
    latency.totalMs = latency.retrievalToAnswerMs;
    return refusal(query, latency, "insufficient_grounding");
  }
  latency.guardrailsMs = elapsed(guardrailStart);

  try {
    const gateway = await retrieveFromGateway({ query: retrievalQuery, language, limit: 3, minGroundingScore: MIN_EXTRACTIVE_COVERAGE }, config, fetchImpl);
    latency.embeddingMs = gateway.timings.queryEmbeddingMs;
    latency.denseRetrievalMs = gateway.timings.denseSearchMs;
    latency.lexicalRetrievalMs = gateway.timings.sparseSearchMs;
    latency.fusionMs = gateway.timings.fusionMs;

    const extractionStarted = performance.now();
    const selected = gateway.matches
      .filter(match => hasSubjectAnchor(match.content, retrievalQuery))
      .map(match => ({ match, extracted: bestGroundedSentence(match.content, retrievalQuery) }));
    const best = selected.sort((left, right) => right.extracted.coverage - left.extracted.coverage || right.match.rrfScore - left.match.rrfScore)[0];
    latency.extractionMs = elapsed(extractionStarted);

    if (!best || best.extracted.coverage < MIN_EXTRACTIVE_COVERAGE || !best.extracted.sentence || !best.match.content.includes(best.extracted.sentence)) {
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
  return runExternalGatewayQuery(query, config, options.language ?? "auto", options.fetchImpl);
}
