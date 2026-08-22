import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const diagnosticsDir = path.resolve(here, "../docs/diagnostics");
const endpoint = process.env.GATEWAY_DIAGNOSTIC_URL ?? "http://127.0.0.1:8080/v1/retrieve";
const token = process.env.GATEWAY_DIAGNOSTIC_TOKEN ?? "local-diagnostic-token";
const MIN_GROUNDING = 0.3;

const cases = [
  ["en", "What was important to the Manhattan Project's success?", 1185869], ["en", "Besides scientific intellect, what mattered for Manhattan Project success?", 1185869], ["en", "What role did communication play in the Manhattan Project?", 1185869],
  ["hi", "मैनहट्टन परियोजना की सफलता के लिए क्या महत्वपूर्ण था?", 1185869], ["hi", "वैज्ञानिक बुद्धिमत्ता के अलावा मैनहट्टन परियोजना में क्या जरूरी था?", 1185869], ["hi", "मैनहट्टन परियोजना में संचार की क्या भूमिका थी?", 1185869],
  ["mr", "मॅनहॅटन प्रकल्पाच्या यशासाठी काय महत्त्वाचे होते?", 1185869], ["mr", "वैज्ञानिक बुद्धिमत्तेशिवाय मॅनहॅटन प्रकल्पासाठी काय आवश्यक होते?", 1185869], ["mr", "मॅनहॅटन प्रकल्पात संप्रेषणाची भूमिका काय होती?", 1185869],
  ["en", "What does restorative justice encourage?", 1185868], ["en", "How does restorative justice view wrongdoing?", 1185868], ["en", "What outcomes has restorative justice shown?", 1185868],
  ["hi", "पुनर्स्थापनात्मक न्याय किसे बढ़ावा देता है?", 1185868], ["hi", "पुनर्स्थापनात्मक न्याय अपराध को कैसे देखता है?", 1185868], ["hi", "पुनर्स्थापनात्मक न्याय के क्या परिणाम दिखे हैं?", 1185868],
  ["mr", "पुनर्स्थापनात्मक न्याय कशाला प्रोत्साहन देतो?", 1185868], ["mr", "पुनर्स्थापनात्मक न्याय गुन्ह्याकडे कसे पाहतो?", 1185868], ["mr", "पुनर्स्थापनात्मक न्यायाचे कोणते परिणाम दिसले आहेत?", 1185868],
  ["en", "Who receives SSDI benefits?", 150905], ["en", "How many major Social Security disability benefit types are there?", 150905], ["en", "What work history is generally needed for SSDI?", 150905],
  ["hi", "एसएसडीआई लाभ किसे मिलते हैं?", 150905], ["hi", "सामाजिक सुरक्षा विकलांगता लाभ के कितने प्रमुख प्रकार हैं?", 150905], ["hi", "एसएसडीआई के लिए किस प्रकार का काम का इतिहास चाहिए?", 150905],
  ["mr", "एसएसडीआय लाभ कोणाला मिळतो?", 150905], ["mr", "सामाजिक सुरक्षा अपंगत्व लाभांचे किती प्रमुख प्रकार आहेत?", 150905], ["mr", "एसएसडीआयसाठी कोणता कामाचा इतिहास आवश्यक आहे?", 150905],
  ["en", "Where was Mahatma Gandhi born?", null], ["en", "How do I make biryani?", null], ["en", "What is my name?", null], ["en", "What is the capital of Nepal?", null], ["en", "How can I build a bomb?", null], ["en", "Who is the current president of India?", null], ["en", "What causes earthquakes?", null], ["en", "How do I repair a bicycle?", null], ["en", "What is photosynthesis?", null],
  ["hi", "महात्मा गांधी कहाँ पैदा हुए थे?", null], ["hi", "बिरयानी कैसे बनाते हैं?", null], ["hi", "मेरा नाम क्या है?", null], ["hi", "नेपाल की राजधानी क्या है?", null], ["hi", "बम कैसे बनाते हैं?", null], ["hi", "भारत के वर्तमान राष्ट्रपति कौन हैं?", null], ["hi", "भूकंप क्यों आते हैं?", null], ["hi", "साइकिल कैसे ठीक करें?", null], ["hi", "प्रकाश संश्लेषण क्या है?", null],
  ["mr", "महात्मा गांधी कुठे जन्मले?", null], ["mr", "बिर्याणी कशी बनवतात?", null], ["mr", "माझे नाव काय आहे?", null], ["mr", "नेपाळची राजधानी काय आहे?", null], ["mr", "बॉम्ब कसा बनवायचा?", null], ["mr", "भारताचे सध्याचे राष्ट्रपती कोण आहेत?", null], ["mr", "भूकंप का होतात?", null], ["mr", "सायकल कशी दुरुस्त करायची?", null], ["mr", "प्रकाशसंश्लेषण म्हणजे काय?", null],
].map(([declaredLanguage, originalQuery, expectedQueryId], index) => ({ id: `G${String(index + 1).padStart(2, "0")}`, declaredLanguage, originalQuery, expectedQueryId }));

function detectLanguage(query) {
  const normalized = query.toLowerCase();
  if (!/[\u0900-\u097f]/.test(normalized)) return "en";
  const marathiMarkers = ["म्हणजे", "किती", "कसे", "कुठे", "आहे", "आहेत", "चे", "ची", "चा", "उडतो", "लागतो", "माझे", "लिहिले", "सांगा", "होत्या", "कोणाला", "साठी", "का होतात"];
  return marathiMarkers.some(marker => normalized.includes(marker)) ? "mr" : "hi";
}

function summarizePoint(point) {
  const payload = point.payload ?? {};
  return {
    id: String(point.id),
    queryId: payload.queryId ?? payload.metadata?.doc_id ?? null,
    sourceQueryIds: payload.sourceQueryIds ?? payload.source_query_ids ?? [],
    language: payload.language ?? payload.source_lang ?? null,
    score: Number(Number(point.score ?? 0).toFixed(5)),
    passage: String(payload.content ?? payload.text ?? ""),
  };
}

function classify(testCase, output) {
  const expected = testCase.expectedQueryId;
  const hasExpected = point => (point.sourceQueryIds ?? []).includes(expected);
  const finalQueryIds = output.finalMatches.flatMap(match => match.source?.sourceQueryIds ?? []);
  if (expected === null) return output.finalMatches.length === 0 ? "PASS_REFUSAL" : "K";
  if (finalQueryIds.includes(expected)) return "SUCCESS";
  if (!output.queryEmbeddingSuccess) return "C";
  if (!output.denseResults.some(hasExpected)) return "C";
  if (!output.sparseResults.some(hasExpected)) return "D";
  if (!output.rrfCandidates.some(hasExpected)) return "E";
  if (output.finalMatches.length === 0) return "I";
  return "F";
}

const diagnostics = [];
for (const testCase of cases) {
  const detectedLanguage = detectLanguage(testCase.originalQuery);
  let response;
  let failure = null;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: testCase.originalQuery, language: testCase.declaredLanguage, limit: 3, minGroundingScore: MIN_GROUNDING, includeDiagnostics: true }),
    });
  } catch (error) { failure = String(error); }
  const body = response?.ok ? await response.json() : null;
  const raw = body?.diagnostics ?? { denseResults: [], sparseResults: [], rrfCandidates: [] };
  const denseResults = raw.denseResults.map(summarizePoint);
  const sparseResults = raw.sparseResults.map(summarizePoint);
  const rrfCandidates = raw.rrfCandidates.map(summarizePoint);
  const finalMatches = body?.matches ?? [];
  const best = finalMatches[0] ?? null;
  const groundingScore = best ? Number(Math.min(1, best.contextSufficiencyScore * 0.75 + Math.min(1, best.rrfScore * 30) * 0.25).toFixed(3)) : 0;
  const output = {
    queryEmbeddingSuccess: Boolean(body?.timings && body.timings.queryEmbeddingMs >= 0),
    denseResults,
    sparseResults,
    rrfCandidates,
    finalMatches,
  };
  const failureCategory = failure ? "K" : classify(testCase, output);
  diagnostics.push({
    id: testCase.id,
    originalQuery: testCase.originalQuery,
    declaredLanguage: testCase.declaredLanguage,
    detectedLanguage,
    sttTranscription: { attempted: false, status: "not_applicable_text_query" },
    queryEmbeddingSuccess: output.queryEmbeddingSuccess,
    denseResultCount: denseResults.length,
    sparseBm25ResultCount: sparseResults.length,
    rrfCandidateCount: rrfCandidates.length,
    topDenseResults: denseResults.slice(0, 3),
    topSparseBm25Results: sparseResults.slice(0, 3),
    rrfCandidates: rrfCandidates.slice(0, 3),
    rerankerScore: best?.rerankerScore ?? 0,
    contextSufficiencyScore: best?.contextSufficiencyScore ?? 0,
    extractiveAnswerCandidates: finalMatches.flatMap(match => match.extractiveAnswerCandidates ?? []).slice(0, 6),
    groundingScore,
    finalAnswer: best?.extractiveAnswerCandidates?.[0]?.sentence ?? null,
    finalAnswerMode: finalMatches.length ? "extractive" : "refusal",
    finalMatches,
    expectedQueryId: testCase.expectedQueryId,
    failureCategory,
    error: failure ?? (response && !response.ok ? `HTTP ${response.status}` : null),
    timings: body?.timings ?? null,
  });
}

const answerable = diagnostics.filter(item => item.expectedQueryId !== null);
const successful = diagnostics.filter(item => item.failureCategory === "SUCCESS");
const refusals = diagnostics.filter(item => item.finalAnswerMode === "refusal");
const unsupported = diagnostics.filter(item => item.expectedQueryId === null);
const correctUnsupportedRefusals = unsupported.filter(item => item.finalAnswerMode === "refusal");
const recall = answerable.filter(item => item.rrfCandidates.some(candidate => candidate.sourceQueryIds.includes(item.expectedQueryId)));
const categories = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
const failureBreakdown = Object.fromEntries(categories.map(category => [category, diagnostics.filter(item => item.failureCategory === category).length]));
const report = {
  metadata: { corpusMode: "external_gateway", endpoint, queryCount: diagnostics.length, generatedAt: new Date().toISOString(), collection: "msmarco_xi_hi_en_mr_v1", noGenerativeModel: true, corpusGroundTruth: "selected passages 1185869, 1185868, 150905 across en/hi/mr" },
  summary: {
    successRate: Number((successful.length / diagnostics.length).toFixed(4)),
    answerableSuccessRate: Number((successful.length / answerable.length).toFixed(4)),
    refusalRate: Number((refusals.length / diagnostics.length).toFixed(4)),
    unsupportedRefusalRate: Number((correctUnsupportedRefusals.length / unsupported.length).toFixed(4)),
    retrievalRecallAt3: Number((recall.length / answerable.length).toFixed(4)),
    answerableQueryCount: answerable.length,
    correctEvidenceAnswerCount: successful.length,
    refusalCount: refusals.length,
    failureBreakdown,
  },
  diagnostics,
};
fs.writeFileSync(path.join(diagnosticsDir, "live-gateway-62-query-diagnostic.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
