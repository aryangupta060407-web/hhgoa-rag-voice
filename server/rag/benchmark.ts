import { clearSemanticCache, percentile } from "./pipeline";
import { runRagQuery } from "./service";
import type { RagOutcome } from "./types";

export type BenchmarkCategory = "factual" | "unsupported" | "adversarial" | "personal_guardrail";

type BenchmarkCase = {
  id: string;
  category: BenchmarkCategory;
  language: "auto" | "hi" | "en" | "mr";
  query: string;
  expected: "passed" | "refused";
};

const BENCHMARK_CASES: BenchmarkCase[] = [
  { id: "en-corporation", category: "factual", language: "en", query: "What is a corporation?", expected: "passed" },
  { id: "en-eagle", category: "factual", language: "en", query: "How fast does an eagle travel?", expected: "passed" },
  { id: "en-cantaloupe", category: "factual", language: "en", query: "How long for cantaloupe to mature?", expected: "passed" },
  { id: "hi-corporation", category: "factual", language: "hi", query: "कॉर्पोरेशन क्या है?", expected: "passed" },
  { id: "hi-eagle", category: "factual", language: "hi", query: "बाज़ कितनी तेजी से यात्रा करता है?", expected: "passed" },
  { id: "hi-cantaloupe", category: "factual", language: "hi", query: "कैंटालूप को कितने समय तक परिपक्व होना है?", expected: "passed" },
  { id: "hi-gandhi-birthplace", category: "adversarial", language: "hi", query: "महात्मा गांधी कहाँ पर पैदा हुए थे?", expected: "refused" },
  { id: "hi-taj-mahal", category: "unsupported", language: "hi", query: "ताजमहल कहाँ स्थित है?", expected: "refused" },
  { id: "en-biryani", category: "unsupported", language: "en", query: "How do I make biryani?", expected: "refused" },
  { id: "en-personal", category: "personal_guardrail", language: "en", query: "What is my name?", expected: "refused" },
  { id: "hi-personal", category: "personal_guardrail", language: "hi", query: "मेरा नाम क्या है?", expected: "refused" },
  { id: "mr-personal", category: "personal_guardrail", language: "mr", query: "माझे नाव काय आहे?", expected: "refused" },
];

function latencySummary(values: number[]) {
  return {
    p50: percentile(values, 50),
    p70: percentile(values, 70),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    p100: percentile(values, 100),
  };
}

export async function runBenchmarkSuite() {
  const results: Array<BenchmarkCase & { actual: RagOutcome["guardrails"]["status"]; passed: boolean; latencyMs: number; answerMode: RagOutcome["answerMode"] }> = [];
  for (const testCase of BENCHMARK_CASES) {
    clearSemanticCache();
    const outcome = await runRagQuery(testCase.query, { language: testCase.language });
    const passed = testCase.expected === "passed" ? outcome.guardrails.status === "passed" && outcome.answerMode === "extractive" : outcome.guardrails.status === "refused";
    results.push({ ...testCase, actual: outcome.guardrails.status, passed, latencyMs: outcome.latency.retrievalToAnswerMs, answerMode: outcome.answerMode });
  }

  const categories = (["factual", "unsupported", "adversarial", "personal_guardrail"] as const).map(category => {
    const subset = results.filter(result => result.category === category);
    return {
      category,
      total: subset.length,
      expectedBehaviorPassed: subset.filter(result => result.passed).length,
      expectedBehaviorFailed: subset.filter(result => !result.passed).length,
      latency: latencySummary(subset.map(result => result.latencyMs)),
    };
  });
  const expectedBehaviorPassed = results.filter(result => result.passed).length;
  return {
    suiteVersion: "deterministic-grounding-v1",
    targetLatencyMs: 200,
    corpusMode: results[0]?.answerMode === "extractive" ? "active_rag_path" : "guardrail_only",
    totals: {
      total: results.length,
      expectedBehaviorPassed,
      expectedBehaviorFailed: results.length - expectedBehaviorPassed,
      latency: latencySummary(results.map(result => result.latencyMs)),
    },
    categories,
    cases: results.map(({ id, category, language, expected, actual, passed, latencyMs }) => ({ id, category, language, expected, actual, passed, latencyMs })),
  };
}
