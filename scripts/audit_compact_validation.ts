import { COMPACT_VALIDATION_DOCUMENTS } from "../server/rag/compactValidation.generated";
import { clearSemanticCache, runDeterministicRag } from "../server/rag/pipeline";

const cases = COMPACT_VALIDATION_DOCUMENTS.flatMap(document => [
  { id: `${document.queryId}-en`, language: "en", query: document.englishQuery },
  { id: `${document.queryId}-hi`, language: "hi", query: document.translatedQuery },
]);

const results = cases.map(testCase => {
  clearSemanticCache();
  const outcome = runDeterministicRag(testCase.query);
  return {
    ...testCase,
    status: outcome.guardrails.status,
    answerMode: outcome.answerMode,
    latencyMs: outcome.latency.retrievalToAnswerMs,
    queryId: outcome.sources[0]?.queryId ?? null,
  };
});

const passed = results.filter(result => result.status === "passed" && result.answerMode === "extractive");
const refused = results.filter(result => result.status === "refused");
console.log(JSON.stringify({
  corpus: "compact-validation-documents-v2",
  documents: COMPACT_VALIDATION_DOCUMENTS.length,
  cases: results.length,
  extractivePassed: passed.length,
  refused: refused.length,
  extractivePassRate: Number((passed.length / Math.max(1, results.length)).toFixed(4)),
  p95LatencyMs: [...results].map(result => result.latencyMs).sort((a, b) => a - b)[Math.max(0, Math.ceil(results.length * 0.95) - 1)],
  failures: results.filter(result => result.status !== "passed" || result.answerMode !== "extractive"),
}, null, 2));
