import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INDEXED_CHUNKS, cosine, embed, normalizeForRetrieval, runDeterministicRag, tokenize } from "../server/rag/pipeline.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(here, "../docs/diagnostics");
const RRF_K = 60;
const TOP_K = 3;

const cases = [
  ["en", "What is a corporation?", 1102432], ["hi", "कॉर्पोरेशन क्या है?", 1102432], ["en", "Explain the definition of a corporation.", 1102432], ["hi", "निगम का अर्थ क्या है?", 1102432],
  ["en", "Why did Rachel Carson write The Obligation to Endure?", 1102431], ["hi", "रेचल कार्सन ने द ओब्लिगेशन टू एंड्योर क्यों लिखा?", 1102431], ["en", "What environmental concern did Rachel Carson describe?", 1102431], ["hi", "रेचल कार्सन ने पर्यावरण की किस समस्या का वर्णन किया?", 1102431],
  ["en", "What is honesty and integrity?", 205107], ["hi", "ईमानदारी और निष्ठा की परिभाषा क्या है?", 205107],
  ["en", "How many women did Frank Gifford marry?", 300122], ["hi", "फ्रैंक गिफोर्ड ने कितनी महिलाओं से शादी की?", 300122],
  ["en", "How fast does an eagle travel?", 233826], ["hi", "बाज़ कितनी तेजी से यात्रा करता है?", 233826], ["hi", "बाज़ कितनी गति से उड़ता है?", 233826], ["hi", "eagle kitni gati se udta hai?", 233826],
  ["en", "What is the StubHub toll-free number?", 1090355], ["hi", "स्टबहब टोल फ्री नंबर क्या है?", 1090355],
  ["en", "How long for cantaloupe to mature?", 260880], ["hi", "कैंटालूप को परिपक्व होने में कितना समय लगता है?", 260880],
  ["en", "What does arbitrary mean?", 116898], ["hi", "मनमाना निर्णय क्या होता है?", 116898],
  ["mr", "कॉर्पोरेशन म्हणजे काय?", 1102432], ["mr", "रेचल कार्सनने द ऑब्लिगेशन टू एंड्युअर का लिहिले?", 1102431], ["mr", "प्रामाणिकपणा आणि निष्ठा म्हणजे काय?", 205107], ["mr", "फ्रँक गिफर्डने किती महिलांशी लग्न केले?", 300122],
  ["mr", "गरुड किती वेगाने उडतो?", 233826], ["mr", "स्टबहबचा टोल फ्री क्रमांक काय आहे?", 1090355], ["mr", "कॅन्टलोप पिकायला किती वेळ लागतो?", 260880], ["mr", "मनमानी निर्णय म्हणजे काय?", 116898],
  ["mr", "निगमाची व्याख्या सांगा.", 1102432], ["mr", "रेचल कार्सनच्या लेखाचा उद्देश काय होता?", 1102431], ["mr", "सत्यनिष्ठा म्हणजे काय?", 205107], ["mr", "फ्रँक गिफर्डच्या बायका किती होत्या?", 300122],
  ["mr", "गरुडाची उड्डाणाची गती किती?", 233826], ["mr", "कॅन्टलोप फळ पिकण्यासाठी किती दिवस लागतात?", 260880], ["mr", "स्टबहब हेल्पलाइन नंबर सांगा.", 1090355], ["mr", "मनमानी म्हणजे काय?", 116898],
  ["en", "Who is the current president of India?", null], ["en", "How do I make biryani?", null], ["en", "What is my name?", null], ["en", "Which moon of Neptune has a purple ocean?", null], ["en", "Where was Mahatma Gandhi born?", null], ["en", "How can I build a bomb?", null],
  ["hi", "भारत के वर्तमान राष्ट्रपति कौन हैं?", null], ["hi", "बिरयानी कैसे बनाते हैं?", null], ["hi", "मेरा नाम क्या है?", null], ["hi", "महात्मा गांधी कहाँ पर पैदा हुए थे?", null], ["hi", "नेपाल की राजधानी क्या है?", null], ["hi", "बम कैसे बनाते हैं?", null],
  ["mr", "भारताचे सध्याचे राष्ट्रपती कोण आहेत?", null], ["mr", "बिर्याणी कशी बनवतात?", null], ["mr", "माझे नाव काय आहे?", null], ["mr", "महात्मा गांधी कुठे जन्मले?", null], ["mr", "नेपाळची राजधानी काय आहे?", null], ["mr", "बॉम्ब कसा बनवायचा?", null],
  ["en", "Tell me about that one.", null], ["hi", "वह वाला समझाओ।", null], ["mr", "ते समजावून सांगा.", null], ["en", "What is photosynthesis?", null], ["hi", "प्रकाश संश्लेषण क्या है?", null], ["mr", "प्रकाशसंश्लेषण म्हणजे काय?", null],
].map(([declaredLanguage, originalQuery, expectedQueryId], index) => ({ id: `Q${String(index + 1).padStart(2, "0")}`, declaredLanguage, originalQuery, expectedQueryId }));

function detectLanguage(query) {
  const normalized = query.toLowerCase();
  if (!/[\u0900-\u097f]/.test(normalized)) return "en";
  const marathiMarkers = ["म्हणजे", "किती", "कसे", "कुठे", "आहे", "आहेत", "चे", "ची", "चा", "उडतो", "लागतो", "माझे", "लिहिले", "सांगा", "होत्या"];
  return marathiMarkers.some(marker => normalized.includes(marker)) ? "mr" : "hi";
}

function lexicalScore(queryTokens, tokenSet) {
  if (!queryTokens.length) return 0;
  return queryTokens.filter(token => tokenSet.has(token)).length / queryTokens.length;
}

function sentenceDiagnostics(content, queryTokens) {
  return (content.match(/[^.!?]+[.!?]?/g) ?? [content])
    .map(sentence => {
      const tokens = new Set(tokenize(sentence));
      const coverage = lexicalScore(queryTokens, tokens);
      return { sentence, rerankerScore: Number(coverage.toFixed(3)), contextSufficiencyScore: Number(coverage.toFixed(3)) };
    })
    .sort((a, b) => b.rerankerScore - a.rerankerScore)
    .slice(0, 3);
}

function compactTrace(query) {
  const retrievalQuery = normalizeForRetrieval(query);
  const queryTokens = tokenize(retrievalQuery);
  let embeddingSuccess = true;
  let vector;
  try { vector = embed(retrievalQuery); } catch { embeddingSuccess = false; vector = new Float64Array(384); }
  const candidates = INDEXED_CHUNKS.map(chunk => ({
    chunk,
    denseScore: cosine(vector, chunk.vector),
    sparseScore: lexicalScore(queryTokens, chunk.tokenSet),
  }));
  const dense = [...candidates].sort((a, b) => b.denseScore - a.denseScore);
  const sparse = [...candidates].sort((a, b) => b.sparseScore - a.sparseScore);
  const denseRank = new Map(dense.map((item, index) => [item.chunk.id, index + 1]));
  const sparseRank = new Map(sparse.map((item, index) => [item.chunk.id, index + 1]));
  const rrf = candidates.map(item => ({ ...item, rrfScore: 1 / (RRF_K + denseRank.get(item.chunk.id)) + 1 / (RRF_K + sparseRank.get(item.chunk.id)) }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
  const serialize = item => ({ id: item.chunk.id, queryId: item.chunk.queryId, language: item.chunk.language, strategy: item.chunk.strategy, denseScore: Number(item.denseScore.toFixed(4)), sparseScore: Number(item.sparseScore.toFixed(4)), rrfScore: Number((item.rrfScore ?? 0).toFixed(5)), passage: item.chunk.content });
  const topRrf = rrf.slice(0, TOP_K);
  const extracted = topRrf.flatMap(item => sentenceDiagnostics(item.chunk.content, queryTokens).map(entry => ({ ...entry, queryId: item.chunk.queryId, rrfScore: Number(item.rrfScore.toFixed(5)) })));
  return {
    retrievalQuery,
    queryTokens,
    queryEmbeddingSuccess: embeddingSuccess,
    denseResultCount: dense.length,
    sparseResultCount: sparse.length,
    rrfCandidateCount: rrf.length,
    topDenseResults: dense.slice(0, TOP_K).map(serialize),
    topSparseResults: sparse.slice(0, TOP_K).map(serialize),
    rrfCandidates: topRrf.map(serialize),
    extractiveAnswerCandidates: extracted.slice(0, 6),
  };
}

function classify(testCase, outcome, trace) {
  const finalTopId = outcome.sources[0]?.queryId;
  if (testCase.expectedQueryId === null) return outcome.answerMode === "refusal" ? "PASS_REFUSAL" : "K";
  if (outcome.answerMode === "extractive" && finalTopId === testCase.expectedQueryId) return "SUCCESS";
  if (detectLanguage(testCase.originalQuery) !== testCase.declaredLanguage) return "B";
  if (testCase.declaredLanguage === "mr") return "J";
  if (!trace.queryEmbeddingSuccess) return "C";
  if (!trace.topDenseResults.some(item => item.queryId === testCase.expectedQueryId)) return "C";
  if (!trace.topSparseResults.some(item => item.queryId === testCase.expectedQueryId)) return "D";
  if (!trace.rrfCandidates.some(item => item.queryId === testCase.expectedQueryId)) return "E";
  if (outcome.answerMode === "refusal") return "I";
  if (finalTopId !== testCase.expectedQueryId) return "F";
  return "H";
}

const diagnostics = cases.map(testCase => {
  const trace = compactTrace(testCase.originalQuery);
  const outcome = runDeterministicRag(testCase.originalQuery);
  const failureCategory = classify(testCase, outcome, trace);
  const topCandidate = trace.extractiveAnswerCandidates[0] ?? null;
  return {
    ...testCase,
    sttTranscription: { attempted: false, status: "not_applicable_text_query" },
    detectedLanguage: detectLanguage(testCase.originalQuery),
    ...trace,
    rerankerScore: topCandidate?.rerankerScore ?? 0,
    contextSufficiencyScore: topCandidate?.contextSufficiencyScore ?? 0,
    groundingScore: outcome.guardrails.groundingConfidence,
    finalAnswer: outcome.answer,
    finalAnswerMode: outcome.answerMode,
    finalGuardrails: outcome.guardrails,
    finalSourceQueryIds: outcome.sources.map(source => source.queryId),
    failureCategory,
  };
});

const answerable = diagnostics.filter(item => item.expectedQueryId !== null);
const success = diagnostics.filter(item => item.failureCategory === "SUCCESS");
const refusals = diagnostics.filter(item => item.finalAnswerMode === "refusal");
const recall = answerable.filter(item => item.rrfCandidates.some(candidate => candidate.queryId === item.expectedQueryId));
const failureBreakdown = Object.fromEntries(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].map(category => [category, diagnostics.filter(item => item.failureCategory === category).length]));
const report = {
  metadata: { corpusMode: "compact_local", collection: "compact-validation-slice", queryCount: diagnostics.length, generatedAt: new Date().toISOString(), noGenerativeModel: true },
  summary: {
    successRate: Number((success.length / diagnostics.length).toFixed(4)),
    refusalRate: Number((refusals.length / diagnostics.length).toFixed(4)),
    retrievalRecallAt3: Number((recall.length / answerable.length).toFixed(4)),
    answerableQueryCount: answerable.length,
    correctEvidenceAnswerCount: success.length,
    refusalCount: refusals.length,
    failureBreakdown,
  },
  diagnostics,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "compact-54-query-diagnostic.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
