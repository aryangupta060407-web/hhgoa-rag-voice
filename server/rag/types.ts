export type ChunkStrategy = "fixed_overlap" | "semantic_sentence" | "metadata_aware";

export type SourceDocument = {
  queryId: number;
  queryType: "DESCRIPTION" | "NUMERIC";
  language: string;
  englishQuery: string;
  translatedQuery: string;
  englishAnswer: string;
  translatedAnswer: string;
  englishPassage: string;
  translatedPassage: string;
};

export type IndexedChunk = {
  id: string;
  queryId: number;
  queryType: string;
  language: string;
  strategy: ChunkStrategy;
  content: string;
  englishContent: string;
  translatedContent: string;
  vector: Float64Array;
  tokenSet: Set<string>;
};

export type StageLatency = {
  guardrailsMs: number;
  cacheMs: number;
  embeddingMs: number;
  denseRetrievalMs: number;
  lexicalRetrievalMs: number;
  fusionMs: number;
  extractionMs: number;
  generalAnswerMs?: number;
  persistenceMs: number;
  retrievalToAnswerMs: number;
  transcriptionMs?: number;
  totalMs: number;
};

export type GuardrailDecision = {
  status: "passed" | "fallback" | "refused";
  reasons: Array<"unsafe_input" | "off_topic" | "insufficient_grounding">;
  domainAffinity: number;
  groundingConfidence: number;
};

export type RetrievedSource = {
  id: string;
  strategy: ChunkStrategy;
  queryId: number;
  language: string;
  relevance: number;
  content: string;
  evidenceSentence: string;
};

export type RagOutcome = {
  transcript: string;
  normalizedQuery: string;
  answer: string | null;
  answerMode: "extractive" | "general_fallback" | "refusal" | "semantic_cache";
  sources: RetrievedSource[];
  guardrails: GuardrailDecision;
  latency: StageLatency;
  cacheHit: boolean;
};

export type TranscriptionOutcome = {
  transcript: string;
  provider: "sarvam" | "whisper_fallback";
  language: string | null;
  latencyMs: number;
  primaryFailure: string | null;
};

export type LatencyPercentiles = {
  sampleSize: number;
  p50: number;
  p70: number;
  p100: number;
};

export type AnalyticsReport = {
  retrievalToAnswer: LatencyPercentiles;
  totalRequest: LatencyPercentiles;
  transcription: LatencyPercentiles;
  perStage: Record<string, LatencyPercentiles>;
};
