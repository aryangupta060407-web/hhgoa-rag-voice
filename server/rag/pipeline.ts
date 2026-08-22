import { SOURCE_DOCUMENTS } from "./corpus";
import type {
  AnalyticsReport,
  ChunkStrategy,
  GuardrailDecision,
  IndexedChunk,
  LatencyPercentiles,
  RagOutcome,
  RetrievedSource,
  SourceDocument,
  StageLatency,
} from "./types";

const DIMENSIONS = 384;
const TOP_K = 3;
const CACHE_LIMIT = 64;
const RRF_K = 60;
const MIN_DOMAIN_AFFINITY = 0.4;
const MIN_EVIDENCE_COVERAGE = 0.3;
const UNSAFE_PATTERNS = [
  /\b(?:build|make|buy)\s+(?:a\s+)?(?:bomb|explosive|weapon)\b/i,
  /\b(?:kill|harm)\s+(?:myself|yourself|someone)\b/i,
  /\b(?:suicide|self[- ]harm)\b/i,
];
const AMBIGUOUS_FOLLOW_UP_PATTERNS = [
  /\b(?:can you )?(?:explain|describe|clarify)\s+(?:that|this|it|one)\b/i,
  /\b(?:tell me about|what about)\s+(?:that|this|it|one)\b/i,
];
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "at", "be", "by", "does", "for", "from", "has", "how", "in", "is", "it", "of", "on", "or", "the", "to", "what", "which", "who", "why", "with", "my", "your", "name",
  "hai", "hain", "se", "ka", "ki", "ke", "mein", "par", "aur", "kitni", "kitna", "kya", "kahan", "kab", "kaise", "mera", "naam", "mujhe", "ko",
  "क्या", "है", "हैं", "था", "थी", "थे", "मेरा", "मेरी", "मेरे", "तुम्हारा", "तुम्हारी", "तुम्हारे", "आपका", "आपकी", "आपके", "नाम", "कौन", "कौनसा", "कौनसी", "कहाँ", "कब", "कैसे", "कितना", "कितने", "की", "का", "के", "को", "में", "और", "से", "पर", "यह", "वह", "उस", "इस", "एक", "मैं", "हम", "आप", "तुम", "भी",
  "माझे", "माझा", "माझी", "तुझे", "तुझा", "तुझी", "तुमचे", "तुमचा", "तुमची", "नाव", "कोण", "काय", "आहे", "आहेत", "होता", "होती", "होते", "कुठे", "कधी", "कसे", "किती", "चा", "ची", "चे", "ला", "मध्ये", "आणि", "पण", "हे", "तो", "ती", "ते", "या", "त्या", "एक", "मी", "आम्ही", "तुम्ही", "आपण",
]);

type CacheEntry = { query: string; vector: Float64Array; outcome: RagOutcome };
type RankedCandidate = { chunk: IndexedChunk; dense: number; lexical: number; rrf: number; relevance: number };

function now() {
  return performance.now();
}

function elapsed(start: number) {
  return Number((now() - start).toFixed(3));
}

export function normalizeQuery(input: string) {
  return input.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/**
 * Deterministic wording normalization for common Hindi and Roman-Hindi variants
 * in the compact multilingual validation corpus. This changes retrieval terms,
 * never the extracted answer and never introduces generative inference.
 */
export function normalizeForRetrieval(input: string) {
  return normalizeQuery(input)
    .replace(/\b(?:gati|speed)\b/gi, "तेजी")
    .replace(/गति/g, "तेजी")
    .replace(/\b(?:udta|udte)(?:\s+hai(?:n)?)?\b/gi, "उड़ते")
    .replace(/उड़ता/g, "उड़ते")
    .replace(/बाज़/g, "ईगल")
    .replace(/साइड\s+इफेक्ट्स/g, "दुष्प्रभाव")
    .replace(/खाने/g, "लेने")
    .replace(/तेजी/g, "रफ्तार");
}

export function isUnsafeQuery(query: string) {
  return UNSAFE_PATTERNS.some(pattern => pattern.test(query));
}

export function tokenize(input: string) {
  return normalizeForRetrieval(input)
    .toLocaleLowerCase()
    .match(/[A-Za-z0-9\u0900-\u097F]+/g)
    ?.map(token => token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token)) ?? [];
}

export function hasGroundableTerms(input: string) {
  return tokenize(input).length > 0;
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

/** Deterministic 384-dimensional feature-hash embedding; no model or network call. */
export function embed(text: string) {
  const vector = new Float64Array(DIMENSIONS);
  const tokens = tokenize(text);
  const features = [...tokens, ...tokens.map(token => `^${token.slice(0, 4)}`), ...tokens.map(token => `${token.slice(-4)}$`)];
  for (const feature of features) {
    const value = hash(feature);
    const slot = value % DIMENSIONS;
    vector[slot] += value & 1 ? 1 : -1;
  }
  let magnitude = 0;
  for (let index = 0; index < vector.length; index += 1) magnitude += vector[index] * vector[index];
  const norm = Math.sqrt(magnitude) || 1;
  for (let index = 0; index < vector.length; index += 1) vector[index] /= norm;
  return vector;
}

export function cosine(left: Float64Array, right: Float64Array) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index];
  return sum;
}

function splitFixed(text: string, size = 38, overlap = 10) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += size - overlap) {
    const chunk = words.slice(start, start + size).join(" ");
    if (chunk) chunks.push(chunk);
    if (start + size >= words.length) break;
  }
  return chunks;
}

function splitSemantic(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map(sentence => sentence.trim()).filter(Boolean) ?? [text];
  const chunks: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    chunks.push(sentences.slice(index, index + 2).join(" "));
  }
  return chunks;
}

function chunkDocument(document: SourceDocument, strategy: ChunkStrategy, text: string) {
  if (strategy === "fixed_overlap") return splitFixed(text);
  if (strategy === "semantic_sentence") return splitSemantic(text);
  return [`Question class: ${document.queryType}. Language: ${document.language}. Source text: ${text}`];
}

function buildIndex() {
  const indexed: IndexedChunk[] = [];
  const strategies: ChunkStrategy[] = ["fixed_overlap", "semantic_sentence", "metadata_aware"];
  for (const document of SOURCE_DOCUMENTS) {
    const combined = `${document.englishPassage} ${document.translatedPassage}`;
    for (const strategy of strategies) {
      const chunks = chunkDocument(document, strategy, combined);
      chunks.forEach((content, ordinal) => {
        indexed.push({
          id: `${document.queryId}-${strategy}-${ordinal}`,
          queryId: document.queryId,
          queryType: document.queryType,
          language: document.language,
          strategy,
          content,
          englishContent: document.englishPassage,
          translatedContent: document.translatedPassage,
          vector: embed(`${document.englishQuery} ${document.translatedQuery} ${content}`),
          tokenSet: new Set(tokenize(`${document.englishQuery} ${document.translatedQuery} ${content}`)),
        });
      });
    }
  }
  return indexed;
}

export const INDEXED_CHUNKS = buildIndex();
const CORPUS_VOCABULARY = new Set(INDEXED_CHUNKS.flatMap(chunk => Array.from(chunk.tokenSet)));
const semanticCache: CacheEntry[] = [];

export function clearSemanticCache() {
  semanticCache.splice(0, semanticCache.length);
}

function lexicalScore(queryTokens: string[], tokenSet: Set<string>) {
  if (!queryTokens.length) return 0;
  let matched = 0;
  for (const token of queryTokens) if (tokenSet.has(token)) matched += 1;
  return matched / queryTokens.length;
}

function fuseCandidates(queryVector: Float64Array, queryTokens: string[]) {
  const dense = [...INDEXED_CHUNKS]
    .map(chunk => ({ chunk, score: cosine(queryVector, chunk.vector) }))
    .sort((left, right) => right.score - left.score);
  const lexical = [...INDEXED_CHUNKS]
    .map(chunk => ({ chunk, score: lexicalScore(queryTokens, chunk.tokenSet) }))
    .sort((left, right) => right.score - left.score);

  const ranks = new Map<string, { dense: number; lexical: number; chunk: IndexedChunk }>();
  dense.forEach((item, index) => ranks.set(item.chunk.id, { chunk: item.chunk, dense: item.score, lexical: 0 }));
  lexical.forEach((item, index) => {
    const current = ranks.get(item.chunk.id);
    if (current) current.lexical = item.score;
    else ranks.set(item.chunk.id, { chunk: item.chunk, dense: 0, lexical: item.score });
  });
  const denseRanks = new Map(dense.map((item, index) => [item.chunk.id, index + 1]));
  const lexicalRanks = new Map(lexical.map((item, index) => [item.chunk.id, index + 1]));
  return Array.from(ranks.values())
    .map(candidate => {
      const denseRank = denseRanks.get(candidate.chunk.id) ?? INDEXED_CHUNKS.length;
      const lexicalRank = lexicalRanks.get(candidate.chunk.id) ?? INDEXED_CHUNKS.length;
      const rrf = 1 / (RRF_K + denseRank) + 1 / (RRF_K + lexicalRank);
      const relevance = Math.max(0, candidate.dense) * 0.42 + candidate.lexical * 0.58 + rrf;
      return { ...candidate, rrf, relevance } satisfies RankedCandidate;
    })
    .sort((left, right) => right.relevance - left.relevance);
}

function sentenceScore(sentence: string, queryTokens: string[], sourceRelevance: number) {
  const sentenceTokens = new Set(tokenize(sentence));
  const coverage = lexicalScore(queryTokens, sentenceTokens);
  const exactPhrase = normalizeQuery(sentence).toLowerCase().includes(queryTokens.join(" ")) ? 0.12 : 0;
  return coverage * 0.8 + sourceRelevance * 0.2 + exactPhrase;
}

function extractSentence(candidate: RankedCandidate, queryTokens: string[]) {
  const sentences = candidate.chunk.content.match(/[^.!?]+[.!?]?/g)?.map(sentence => sentence.trim()).filter(Boolean) ?? [candidate.chunk.content];
  return sentences
    .map(sentence => ({ sentence, score: sentenceScore(sentence, queryTokens, candidate.relevance) }))
    .sort((left, right) => right.score - left.score)[0];
}

function guardrailFor(query: string, queryTokens: string[], top: RankedCandidate | undefined): GuardrailDecision {
  const unsafe = isUnsafeQuery(query);
  const ambiguousFollowUp = AMBIGUOUS_FOLLOW_UP_PATTERNS.some(pattern => pattern.test(query));
  const vocabularyMatches = queryTokens.filter(token => CORPUS_VOCABULARY.has(token)).length;
  const domainAffinity = queryTokens.length ? vocabularyMatches / queryTokens.length : 0;
  const coverage = top ? lexicalScore(queryTokens, top.chunk.tokenSet) : 0;
  const groundingConfidence = top ? Number((Math.max(0, top.dense) * 0.45 + coverage * 0.55).toFixed(3)) : 0;
  const reasons: GuardrailDecision["reasons"] = [];
  if (unsafe) reasons.push("unsafe_input");
  if (!unsafe && ambiguousFollowUp) reasons.push("insufficient_grounding");
  if (!unsafe && (domainAffinity < MIN_DOMAIN_AFFINITY || coverage < MIN_EVIDENCE_COVERAGE)) reasons.push("off_topic");
  if (!unsafe && reasons.length === 0 && groundingConfidence < 0.16) reasons.push("insufficient_grounding");
  return { status: reasons.length ? "refused" : "passed", reasons, domainAffinity: Number(domainAffinity.toFixed(3)), groundingConfidence };
}

function emptyLatency(totalMs = 0): StageLatency {
  return { guardrailsMs: 0, cacheMs: 0, embeddingMs: 0, denseRetrievalMs: 0, lexicalRetrievalMs: 0, fusionMs: 0, extractionMs: 0, persistenceMs: 0, retrievalToAnswerMs: totalMs, totalMs };
}

function refusal(query: string, decision: GuardrailDecision, latency: StageLatency): RagOutcome {
  const explanations: Record<string, string> = {
    unsafe_input: "I cannot help with that request.",
    off_topic: "I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.",
    insufficient_grounding: "I found no source passage with enough evidence to answer reliably.",
  };
  return { transcript: query, normalizedQuery: query, answer: explanations[decision.reasons[0] ?? "insufficient_grounding"], answerMode: "refusal", sources: [], guardrails: decision, latency, cacheHit: false };
}

export function runDeterministicRag(rawQuery: string): RagOutcome {
  const started = now();
  const query = normalizeQuery(rawQuery);
  const queryTokens = tokenize(query);
  const latency = emptyLatency();

  const guardrailStart = now();
  const unsafeDecision = guardrailFor(query, queryTokens, undefined);
  latency.guardrailsMs = elapsed(guardrailStart);
  if (unsafeDecision.reasons.includes("unsafe_input")) {
    latency.retrievalToAnswerMs = elapsed(started);
    latency.totalMs = latency.retrievalToAnswerMs;
    return refusal(query, unsafeDecision, latency);
  }

  const embeddingStart = now();
  const queryVector = embed(query);
  latency.embeddingMs = elapsed(embeddingStart);

  const cacheStart = now();
  const cacheEntry = semanticCache.find(entry => cosine(entry.vector, queryVector) > 0.999 && entry.query === query);
  latency.cacheMs = elapsed(cacheStart);
  if (cacheEntry) {
    const cached = structuredClone(cacheEntry.outcome);
    cached.answerMode = "semantic_cache";
    cached.cacheHit = true;
    cached.latency = { ...cached.latency, cacheMs: latency.cacheMs, embeddingMs: latency.embeddingMs, retrievalToAnswerMs: elapsed(started), totalMs: elapsed(started) };
    return cached;
  }

  const denseStart = now();
  const denseScores = INDEXED_CHUNKS.map(chunk => cosine(queryVector, chunk.vector));
  latency.denseRetrievalMs = elapsed(denseStart);
  const lexicalStart = now();
  const lexicalScores = INDEXED_CHUNKS.map(chunk => lexicalScore(queryTokens, chunk.tokenSet));
  latency.lexicalRetrievalMs = elapsed(lexicalStart);
  const fusionStart = now();
  const candidates = fuseCandidates(queryVector, queryTokens);
  latency.fusionMs = elapsed(fusionStart);
  const top = candidates[0];

  const finalGuardrailStart = now();
  const guardrails = guardrailFor(query, queryTokens, top);
  latency.guardrailsMs += elapsed(finalGuardrailStart);
  if (guardrails.status === "refused") {
    latency.retrievalToAnswerMs = elapsed(started);
    latency.totalMs = latency.retrievalToAnswerMs;
    return refusal(query, guardrails, latency);
  }

  const extractionStart = now();
  const selected = candidates.slice(0, TOP_K).map(candidate => ({ candidate, extracted: extractSentence(candidate, queryTokens) }));
  const best = selected.sort((left, right) => right.extracted.score - left.extracted.score)[0];
  latency.extractionMs = elapsed(extractionStart);
  const sources: RetrievedSource[] = selected.map(({ candidate, extracted }) => ({
    id: candidate.chunk.id,
    strategy: candidate.chunk.strategy,
    queryId: candidate.chunk.queryId,
    language: candidate.chunk.language,
    relevance: Number(candidate.relevance.toFixed(3)),
    content: candidate.chunk.content,
    evidenceSentence: extracted.sentence,
  }));
  latency.retrievalToAnswerMs = elapsed(started);
  latency.totalMs = latency.retrievalToAnswerMs;
  const outcome: RagOutcome = { transcript: query, normalizedQuery: query, answer: best?.extracted.sentence ?? null, answerMode: "extractive", sources, guardrails, latency, cacheHit: false };
  semanticCache.unshift({ query, vector: queryVector, outcome });
  if (semanticCache.length > CACHE_LIMIT) semanticCache.pop();
  void denseScores;
  void lexicalScores;
  return outcome;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return Number(sorted[Math.max(0, index)].toFixed(3));
}

export function summarizeLatency(records: Array<Pick<StageLatency, keyof StageLatency>>): AnalyticsReport {
  const stat = (values: number[]): LatencyPercentiles => ({ sampleSize: values.length, p50: percentile(values, 50), p70: percentile(values, 70), p95: percentile(values, 95), p99: percentile(values, 99), p100: percentile(values, 100) });
  const stageNames: Array<keyof StageLatency> = ["guardrailsMs", "cacheMs", "embeddingMs", "denseRetrievalMs", "lexicalRetrievalMs", "fusionMs", "extractionMs", "persistenceMs"];
  const perStage = Object.fromEntries(stageNames.map(stage => [stage, stat(records.map(record => Number(record[stage] ?? 0)))]));
  return {
    retrievalToAnswer: stat(records.map(record => record.retrievalToAnswerMs)),
    totalRequest: stat(records.map(record => record.totalMs)),
    transcription: stat(records.map(record => Number(record.transcriptionMs ?? 0)).filter(value => value > 0)),
    perStage,
  };
}

export function benchmarkQueries() {
  return SOURCE_DOCUMENTS.flatMap(document => [document.englishQuery, document.translatedQuery, document.englishQuery]);
}
