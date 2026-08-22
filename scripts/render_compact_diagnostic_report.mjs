import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const diagnosticsDir = path.resolve(here, "../docs/diagnostics");
const raw = JSON.parse(fs.readFileSync(path.join(diagnosticsDir, "compact-54-query-diagnostic.json"), "utf8"));
const { summary, diagnostics } = raw;

const labels = {
  A: "STT/transcription failure", B: "Language detection/filter failure", C: "Dense retrieval failure", D: "BM25 retrieval failure", E: "RRF/fusion failure", F: "Reranking failure", G: "Context sufficiency threshold too strict", H: "Extractive answer generation failure", I: "Grounding threshold too strict / unsafe false answer", J: "Dataset/index coverage limitation", K: "Other",
};

const pct = value => `${(value * 100).toFixed(1)}%`;
const short = value => value.length > 220 ? `${value.slice(0, 217)}…` : value;
const answerableFailures = diagnostics.filter(item => item.expectedQueryId !== null && item.failureCategory !== "SUCCESS");
const unsupportedFalseAnswers = diagnostics.filter(item => item.expectedQueryId === null && item.finalAnswerMode !== "refusal");
const representative = [...answerableFailures, ...unsupportedFalseAnswers].slice(0, 10);
const categoryRows = Object.entries(summary.failureBreakdown).filter(([, count]) => count > 0)
  .map(([category, count]) => `| ${category} | ${labels[category]} | ${count} |`)
  .join("\n") || "| — | No classified failures | 0 |";
const languageRows = ["en", "hi", "mr"].map(language => {
  const subset = diagnostics.filter(item => item.detectedLanguage === language);
  const succeeded = subset.filter(item => item.failureCategory === "SUCCESS" || item.failureCategory === "PASS_REFUSAL").length;
  const refused = subset.filter(item => item.finalAnswerMode === "refusal").length;
  return `| ${language} | ${subset.length} | ${succeeded} | ${refused} |`;
}).join("\n");
const representativeRows = representative.map(item => {
  const passage = item.rrfCandidates[0]?.passage ?? "No RRF candidate";
  const scores = item.rrfCandidates[0] ? `dense ${item.rrfCandidates[0].denseScore}; sparse ${item.rrfCandidates[0].sparseScore}; RRF ${item.rrfCandidates[0].rrfScore}` : "—";
  return `### ${item.id} — ${item.failureCategory}: ${labels[item.failureCategory] ?? "Unexpected answer"}\n\n**Query:** ${item.originalQuery}\n\n**Detected language:** ${item.detectedLanguage}. **Expected query ID:** ${item.expectedQueryId ?? "no in-corpus answer expected"}. **Final mode:** ${item.finalAnswerMode}. **Grounding score:** ${item.groundingScore}. **Context sufficiency:** ${item.contextSufficiencyScore}. **Reranker score:** ${item.rerankerScore}.\n\n**Top retrieved scores:** ${scores}.\n\n> ${short(passage)}\n\n**Extractive candidates:** ${item.extractiveAnswerCandidates.slice(0, 2).map(candidate => `“${short(candidate.sentence)}” (${candidate.rerankerScore})`).join("; ") || "none"}.\n\n**Final answer/refusal:** ${item.finalAnswer ?? "null"}`;
}).join("\n\n");

const markdown = `# 54-Query Multilingual Deterministic RAG Coverage Diagnosis

## Scope and methodology

This audit executed **${raw.metadata.queryCount} typed queries** through the current compact-local deterministic pipeline: ${diagnostics.filter(item => item.detectedLanguage === "en").length} English, ${diagnostics.filter(item => item.detectedLanguage === "hi").length} Hindi, and ${diagnostics.filter(item => item.detectedLanguage === "mr").length} Marathi. No LLM, generation, or architecture change was used. The machine-readable companion file records every requested stage for every query: original query, text-mode STT status, detected language, embedding state, dense/sparse/RRF counts and results, passages, extractive candidates, reranker/context/grounding values, and final outcome.

> **Interpretation boundary:** this test measures the current in-app compact validation slice, not the offline 8,311-passage collection, because the external Qdrant gateway is not currently connected to the preview. Its dense stage is the compact deterministic feature-hash retriever and its sparse stage is lexical-token overlap; it is not a live Qdrant BM25 measurement. The result is therefore a precise diagnosis of the current coverage problem, not a claim about the unconnected full index.

## Measured results

| Metric | Result |
|---|---:|
| Queries | ${raw.metadata.queryCount} |
| Correct evidence answers / all queries | ${summary.correctEvidenceAnswerCount} / ${raw.metadata.queryCount} (${pct(summary.successRate)}) |
| Refusals / all queries | ${summary.refusalCount} / ${raw.metadata.queryCount} (${pct(summary.refusalRate)}) |
| Retrieval recall@3 among known answerable cases | ${pct(summary.retrievalRecallAt3)} |
| Expected-answerable cases | ${summary.answerableQueryCount} |

| Detected language | Queries | Expected behavior passes | Refusals |
|---|---:|---:|---:|
${languageRows}

## Failure categories

| Category | Meaning | Count |
|---|---|---:|
${categoryRows}

The dominant observed failure mode is **J — dataset/index coverage limitation**: the active compact slice contains English and Hindi evidence, but does not contain Marathi corpus passages. The remaining false acceptance is **K — Other**, specifically a lexical grounding collision that selected a Frank Gifford birthplace sentence for an unrelated Gandhi birthplace question. There were no measured BM25, RRF, or reranker losses in the answerable set once the expected item appeared in the compact candidate list.

## Ten representative failed queries with evidence

${representativeRows || "No failures were selected."}

## Smallest changes likely to improve coverage

The measured bottleneck is not answer generation: the application is already extractive. The smallest high-impact actions are to connect the 8,311-passage Qdrant collection, keep the current dense-plus-BM25/RRF path, and create a deterministic multilingual query-normalization/alias table from actual false refusals. Marathi needs real Marathi passages in the active collection; synonym rules alone cannot create missing Marathi evidence. Keep the existing grounding threshold for unrelated questions, but evaluate calibrated per-language coverage after the full gateway is connected rather than relaxing it globally.

The next benchmark should run the same suite through the hosted Qdrant gateway and compare compact versus external recall@3, answer coverage, refusal precision, and P50/P70/P95/P99/P100 latency.
`;

fs.writeFileSync(path.join(diagnosticsDir, "compact-54-query-diagnostic-report.md"), `${markdown}\n`);
console.log(JSON.stringify({ report: path.join(diagnosticsDir, "compact-54-query-diagnostic-report.md"), representativeFailureCount: representative.length }, null, 2));
