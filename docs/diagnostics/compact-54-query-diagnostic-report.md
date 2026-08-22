# 54-Query Multilingual Deterministic RAG Coverage Diagnosis

## Scope and methodology

This audit executed **62 typed queries** through the current compact-local deterministic pipeline: 19 English, 20 Hindi, and 23 Marathi. No LLM, generation, or architecture change was used. The machine-readable companion file records every requested stage for every query: original query, text-mode STT status, detected language, embedding state, dense/sparse/RRF counts and results, passages, extractive candidates, reranker/context/grounding values, and final outcome.

> **Interpretation boundary:** this test measures the current in-app compact validation slice, not the offline 8,311-passage collection, because the external Qdrant gateway is not currently connected to the preview. Its dense stage is the compact deterministic feature-hash retriever and its sparse stage is lexical-token overlap; it is not a live Qdrant BM25 measurement. The result is therefore a precise diagnosis of the current coverage problem, not a claim about the unconnected full index.

## Measured results

| Metric | Result |
|---|---:|
| Queries | 62 |
| Correct evidence answers / all queries | 27 / 62 (43.5%) |
| Refusals / all queries | 34 / 62 (54.8%) |
| Retrieval recall@3 among known answerable cases | 79.0% |
| Expected-answerable cases | 38 |

| Detected language | Queries | Expected behavior passes | Refusals |
|---|---:|---:|---:|
| en | 19 | 18 | 7 |
| hi | 20 | 20 | 9 |
| mr | 23 | 12 | 18 |

## Failure categories

| Category | Meaning | Count |
|---|---|---:|
| J | Dataset/index coverage limitation | 11 |
| K | Other | 1 |

The dominant observed failure mode is **J — dataset/index coverage limitation**: the active compact slice contains English and Hindi evidence, but does not contain Marathi corpus passages. The remaining false acceptance is **K — Other**, specifically a lexical grounding collision that selected a Frank Gifford birthplace sentence for an unrelated Gandhi birthplace question. There were no measured BM25, RRF, or reranker losses in the answerable set once the expected item appeared in the compact candidate list.

## Ten representative failed queries with evidence

### Q24 — J: Dataset/index coverage limitation

**Query:** रेचल कार्सनने द ऑब्लिगेशन टू एंड्युअर का लिहिले?

**Detected language:** mr. **Expected query ID:** 1102431. **Final mode:** refusal. **Grounding score:** 0.164. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.1585; sparse 0.1667; RRF 0.03154.

> Carson believes that as man tries to eliminate unwanted insects and weeds, he is actually causing more problems by polluting the environment with DDT and harming living things. Carson adds that the intensification of …

**Extractive candidates:** “Carson believes that as man tries to eliminate unwanted insects and weeds, he is actually causing more problems by polluting the environment with DDT and harming living things.” (0); “ Carson adds that the intensification of agriculture is causing other” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q25 — J: Dataset/index coverage limitation

**Query:** प्रामाणिकपणा आणि निष्ठा म्हणजे काय?

**Detected language:** mr. **Expected query ID:** 205107. **Final mode:** refusal. **Grounding score:** 0.081. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.1209; sparse 0; RRF 0.03054.

> Early incorporated entities were established by charter. मैकडॉनल्ड कॉर्पोरेशन दुनिया के सबसे पहचानने योग्य निगमों में से एक है। एक निगम एक कंपनी या लोगों का समूह है जो एक एकल इकाई कानूनी रूप से एक व्यक्ति के रूप में क…

**Extractive candidates:** “Early incorporated entities were established by charter.” (0); “ मैकडॉनल्ड कॉर्पोरेशन दुनिया के सबसे पहचानने योग्य निगमों में से एक है। एक निगम एक कंपनी या लोगों का समूह है जो एक एकल इकाई कानूनी रूप से एक व्यक्ति के रूप में कार्य करने के लिए अधिकृत है और कानून में इस तरह से मान्यत…” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q26 — J: Dataset/index coverage limitation

**Query:** फ्रँक गिफर्डने किती महिलांशी लग्न केले?

**Detected language:** mr. **Expected query ID:** 300122. **Final mode:** refusal. **Grounding score:** 0.103. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.1849; sparse 0; RRF 0.03016.

> खरपतवारों को खत्म करने की कोशिश करता है, वैसे-वैसे वह वास्तव में पर्यावरण को प्रदूषित करके और अधिक समस्याएँ पैदा कर रहा है, उदाहरण के लिए डी डी टी और जीवित चीजों को नुकसान पहुँचा रहा है। कार्सन

**Extractive candidates:** “खरपतवारों को खत्म करने की कोशिश करता है, वैसे-वैसे वह वास्तव में पर्यावरण को प्रदूषित करके और अधिक समस्याएँ पैदा कर रहा है, उदाहरण के लिए डी डी टी और जीवित चीजों को नुकसान पहुँचा रहा है। कार्सन” (0); “Honesty is the condition of being honest, sincerity or fairness, virtue or respect.” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q27 — J: Dataset/index coverage limitation

**Query:** गरुड किती वेगाने उडतो?

**Detected language:** mr. **Expected query ID:** 233826. **Final mode:** refusal. **Grounding score:** 0.043. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.0955; sparse 0; RRF 0.03068.

> खरपतवारों को खत्म करने की कोशिश करता है, वैसे-वैसे वह वास्तव में पर्यावरण को प्रदूषित करके और अधिक समस्याएँ पैदा कर रहा है, उदाहरण के लिए डी डी टी और जीवित चीजों को नुकसान पहुँचा रहा है। कार्सन

**Extractive candidates:** “खरपतवारों को खत्म करने की कोशिश करता है, वैसे-वैसे वह वास्तव में पर्यावरण को प्रदूषित करके और अधिक समस्याएँ पैदा कर रहा है, उदाहरण के लिए डी डी टी और जीवित चीजों को नुकसान पहुँचा रहा है। कार्सन” (0); “कार्सन का मानना है कि जैसे-जैसे मनुष्य अवांछित कीटों और खरपतवारों को खत्म करने की कोशिश करता है, वैसे-वैसे वह वास्तव में पर्यावरण को प्रदूषित करके और अधिक समस्याएँ पैदा कर रहा है, उदाहरण के लिए डी डी टी और जीवित चीजों…” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q29 — J: Dataset/index coverage limitation

**Query:** कॅन्टलोप पिकायला किती वेळ लागतो?

**Detected language:** mr. **Expected query ID:** 260880. **Final mode:** refusal. **Grounding score:** 0.073. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.1408; sparse 0; RRF 0.03037.

> Carson adds that the intensification of agriculture is causing other major problems, like newly developed insects and diseases. कार्सन का मानना है कि जैसे-जैसे मनुष्य अवांछित कीटों और खरपतवारों को खत्म करने की कोशिश क…

**Extractive candidates:** “Carson adds that the intensification of agriculture is causing other major problems, like newly developed insects and diseases.” (0); “ कार्सन का मानना है कि जैसे-जैसे मनुष्य अवांछित कीटों और खरपतवारों को खत्म करने की कोशिश करता है, वैसे-वैसे वह” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q31 — J: Dataset/index coverage limitation

**Query:** निगमाची व्याख्या सांगा.

**Detected language:** mr. **Expected query ID:** 1102432. **Final mode:** refusal. **Grounding score:** 0.043. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.0953; sparse 0; RRF 0.032.

> एक निगम एक कंपनी या लोगों का समूह है जो एक एकल इकाई कानूनी रूप से एक व्यक्ति के रूप में कार्य करने के लिए अधिकृत है और कानून में इस तरह से मान्यता प्राप्त है। प्रारंभिक निगमित

**Extractive candidates:** “एक निगम एक कंपनी या लोगों का समूह है जो एक एकल इकाई कानूनी रूप से एक व्यक्ति के रूप में कार्य करने के लिए अधिकृत है और कानून में इस तरह से मान्यता प्राप्त है। प्रारंभिक निगमित” (0); “Early incorporated entities were established by charter.” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q32 — J: Dataset/index coverage limitation

**Query:** रेचल कार्सनच्या लेखाचा उद्देश काय होता?

**Detected language:** mr. **Expected query ID:** 1102431. **Final mode:** refusal. **Grounding score:** 0.23. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.2046; sparse 0.25; RRF 0.03279.

> Carson believes that as man tries to eliminate unwanted insects and weeds, he is actually causing more problems by polluting the environment with DDT and harming living things. Carson adds that the intensification of …

**Extractive candidates:** “Carson believes that as man tries to eliminate unwanted insects and weeds, he is actually causing more problems by polluting the environment with DDT and harming living things.” (0); “ Carson adds that the intensification of agriculture is causing other” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q33 — J: Dataset/index coverage limitation

**Query:** सत्यनिष्ठा म्हणजे काय?

**Detected language:** mr. **Expected query ID:** 205107. **Final mode:** refusal. **Grounding score:** 0.111. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.1641; sparse 0; RRF 0.03083.

> legally a person and recognized as such in law. Early incorporated entities were established by charter. मैकडॉनल्ड कॉर्पोरेशन दुनिया के सबसे पहचानने योग्य निगमों में से एक है। एक निगम एक कंपनी या लोगों का समूह है जो

**Extractive candidates:** “legally a person and recognized as such in law.” (0); “ Early incorporated entities were established by charter.” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q34 — J: Dataset/index coverage limitation

**Query:** फ्रँक गिफर्डच्या बायका किती होत्या?

**Detected language:** mr. **Expected query ID:** 300122. **Final mode:** refusal. **Grounding score:** 0.101. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.0512; sparse 0; RRF 0.02874.

> McDonald's Corporation is one of the most recognizable corporations in the world. A corporation is a company or group of people authorized to act as a single entity legally a person and recognized as such in law. Early

**Extractive candidates:** “McDonald's Corporation is one of the most recognizable corporations in the world.” (0); “ A corporation is a company or group of people authorized to act as a single entity legally a person and recognized as such in law.” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

### Q35 — J: Dataset/index coverage limitation

**Query:** गरुडाची उड्डाणाची गती किती?

**Detected language:** mr. **Expected query ID:** 233826. **Final mode:** refusal. **Grounding score:** 0.062. **Context sufficiency:** 0. **Reranker score:** 0.

**Top retrieved scores:** dense 0.1374; sparse 0; RRF 0.03175.

> कानून में इस तरह से मान्यता प्राप्त है। प्रारंभिक निगमित संस्थाएं चार्टर द्वारा स्थापित की गई थीं।

**Extractive candidates:** “कानून में इस तरह से मान्यता प्राप्त है। प्रारंभिक निगमित संस्थाएं चार्टर द्वारा स्थापित की गई थीं।” (0); “Early incorporated entities were established by charter.” (0).

**Final answer/refusal:** I could not find a sufficiently related answer in the indexed MSMARCO-XI evidence.

## Smallest changes likely to improve coverage

The measured bottleneck is not answer generation: the application is already extractive. The smallest high-impact actions are to connect the 8,311-passage Qdrant collection, keep the current dense-plus-BM25/RRF path, and create a deterministic multilingual query-normalization/alias table from actual false refusals. Marathi needs real Marathi passages in the active collection; synonym rules alone cannot create missing Marathi evidence. Keep the existing grounding threshold for unrelated questions, but evaluate calibrated per-language coverage after the full gateway is connected rather than relaxing it globally.

The next benchmark should run the same suite through the hosted Qdrant gateway and compare compact versus external recall@3, answer coverage, refusal precision, and P50/P70/P95/P99/P100 latency.

