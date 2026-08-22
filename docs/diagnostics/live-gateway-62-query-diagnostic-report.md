# Live Qdrant Hybrid Retrieval Coverage Diagnosis

## Scope

This report executed 54 typed English, Hindi, and Marathi queries against the **live external gateway** backed by msmarco_xi_hi_en_mr_v1. Every request used real multilingual E5 dense embeddings, Qdrant BM25 sparse search, RRF fusion, deterministic sentence reranking, context sufficiency, and extractive grounding. No LLM was used. The answerable cases use verified selected corpus passages with source query IDs 1185869, 1185868, and 150905 in all three languages.

## Results

| Metric | Result |
|---|---:|
| Queries | 54 |
| Correct evidence answers / all queries | 22 / 54 (40.7%) |
| Answerable-case success rate | 22 / 27 (81.5%) |
| Refusals / all queries | 19 / 54 (35.2%) |
| Unsupported-query refusal rate | 51.8% |
| Retrieval recall@3 among known answerable cases | 92.6% |
| Expected-answerable cases | 27 |

## Failure categories

| Category | Meaning | Count |
|---|---|---:|
| D | BM25 retrieval failure | 2 |
| I | Grounding threshold too strict | 3 |
| K | Other | 13 |

## Ten representative failures with real passages and scores

### G18 — I: Grounding threshold too strict

**Query:** पुनर्स्थापनात्मक न्यायाचे कोणते परिणाम दिसले आहेत?

**Language:** mr. **Embedding:** success. **Counts:** dense 24, BM25 24, RRF 3.

**Top scores:** dense: 0.8889; BM25: 41.69505; RRF: 0.0328. **Reranker/context/grounding:** 0 / 0 / 0.

> या शोधनिबंधाचा उद्देश गुन्हेगारी न्याय व्यवस्थेतील अनेक अनिर्णित मुद्दे दाखवणे, पुनर्स्थापनात्मक न्यायाची मूळ तत्त्वे मांडणे आणि नंतर पीडिता-अपराधी मध्यस्थीच्या वाढत्या प्रमाणावरील अनुभवजन्य आकडेवारीचा आढावा घेणे हा आहे.

**Extractive candidates:** none.

**Final answer/refusal:** refusal

### G22 — I: Grounding threshold too strict

**Query:** एसएसडीआई लाभ किसे मिलते हैं?

**Language:** hi. **Embedding:** success. **Counts:** dense 24, BM25 24, RRF 3.

**Top scores:** dense: 0.89229; BM25: 23.81068; RRF: 0.03333. **Reranker/context/grounding:** 0 / 0 / 0.

> सामाजिक सुरक्षा विकलांगता लाभ के पाँच प्रमुख प्रकार हैं। सामाजिक सुरक्षा विकलांगता बीमा लाभ (एस.एस.डी.आई.) सामाजिक सुरक्षा विकलांगता लाभ का सबसे महत्वपूर्ण प्रकार है। यह उन व्यक्तियों को मिलता है जिन्होंने हाल के वर्षों में (अधिकांश मामल…

**Extractive candidates:** none.

**Final answer/refusal:** refusal

### G24 — D: BM25 retrieval failure

**Query:** एसएसडीआई के लिए किस प्रकार का काम का इतिहास चाहिए?

**Language:** mr. **Embedding:** success. **Counts:** dense 24, BM25 24, RRF 3.

**Top scores:** dense: 0.84555; BM25: 34.85124; RRF: 0.01667. **Reranker/context/grounding:** 0 / 0 / 0.

> केवल फिनिकी या खाने का विकार? ... लिपिड विकार आमतौर पर लक्षण पैदा नहीं करते हैं। ... निम्नलिखित संकेत या लक्षण चिकित्सा इतिहास या शारीरिक परीक्षा से पाए जा सकते हैं: त्वचा या टेंडन में वसायुक्त जमाव जो रक्त में लिपिड के बहुत उच्च स्तर के…

**Extractive candidates:** none.

**Final answer/refusal:** refusal

### G25 — I: Grounding threshold too strict

**Query:** एसएसडीआय लाभ कोणाला मिळतो?

**Language:** mr. **Embedding:** success. **Counts:** dense 24, BM25 24, RRF 3.

**Top scores:** dense: 0.88224; BM25: 17.18389; RRF: 0.01667. **Reranker/context/grounding:** 0 / 0 / 0.

> दक्षिण-मध्य अलास्का में भूकंप - 2002 का देनाली फॉल्ट भूकंप 3 नवंबर 2002 को अलास्का में आया, जिसने सुसित्ना ग्लेशियर, देनाली और टोट्सचुंडा फॉल्ट के साथ-साथ 209 मील तक पृथ्वी की सतह को भी फाड़ दिया।

**Extractive candidates:** none.

**Final answer/refusal:** refusal

### G27 — D: BM25 retrieval failure

**Query:** एसएसडीआयसाठी कोणता कामाचा इतिहास आवश्यक आहे?

**Language:** mr. **Embedding:** success. **Counts:** dense 24, BM25 24, RRF 3.

**Top scores:** dense: 0.85042; BM25: 28.96354; RRF: 0.0269. **Reranker/context/grounding:** 0 / 0 / 0.

> SYSDATE हे डेटाबेस ज्या ऑपरेटिंग सिस्टमवर सेट केलेले आहे त्यासाठी सध्याची तारीख आणि वेळ परत करते. परत केलेल्या मूल्याचा डेटाटाइप डेट_एआरटीएलएस_डेटएआरटीएलएस_स्वरूप प्रारंभिकीकरण पॅरामीटरच्या मूल्यावर अवलंबून असतो. या फंक्शनला कोणत्याही तर…

**Extractive candidates:** none.

**Final answer/refusal:** refusal

### G28 — K: Other

**Query:** Where was Mahatma Gandhi born?

**Language:** en. **Embedding:** success. **Counts:** dense 24, BM25 17, RRF 3.

**Top scores:** dense: 0.78667; BM25: 3.24002; RRF: 0.03226. **Reranker/context/grounding:** 0.4 / 0.4 / 0.542.

> 33 years old Alexander was around 33 years of age when he died from malaria. Born July 20, 356 BC in Pella, Macedon in Greece Died June 10 or June 11, 323 BC (aged 32) … Correction my fine dimwtted friend....... Alexander The Great was b…

**Extractive candidates:** “Alexander The Great was born in Macedonia because his father, King Phillip II was the king of Macedonia.” (0.4); “James Earl Chaney was a young black man born and raised in Meridian, Mississippi.” (0.4).

**Final answer/refusal:** Alexander The Great was born in Macedonia because his father, King Phillip II was the king of Macedonia.

### G29 — K: Other

**Query:** How do I make biryani?

**Language:** en. **Embedding:** success. **Counts:** dense 24, BM25 24, RRF 3.

**Top scores:** dense: 0.83434; BM25: 3.31984; RRF: 0.01667. **Reranker/context/grounding:** 0.75 / 0.75 / 0.688.

> Method: Preheat the oven to 400°F. Put 1 tablespoon of the oil, 1/2 tablespoon of the rosemary, thyme, garlic, 1 1/2 teaspoons of the salt and 1/2 teaspoon of the pepper into a small bowl and mix well. Rub mixture all over beef; set asid…

**Extractive candidates:** “Since I have no experience with stage make-up, I hired someone to do my make-up on the morning of the contest for $50.” (0.75).

**Final answer/refusal:** Since I have no experience with stage make-up, I hired someone to do my make-up on the morning of the contest for $50.

### G31 — K: Other

**Query:** What is the capital of Nepal?

**Language:** en. **Embedding:** success. **Counts:** dense 24, BM25 9, RRF 3.

**Top scores:** dense: 0.81892; BM25: 3.28874; RRF: 0.03333. **Reranker/context/grounding:** 0.5 / 0.5 / 0.625.

> Annapurna is a section of the Himalayas in north-central Nepal. Annapurna is a series of peaks, the highest of which is called Annapurna I, which is the tenth highest mountain in the world. It is located in central Nepal and is approxima…

**Extractive candidates:** “Annapurna is a section of the Himalayas in north-central Nepal.” (0.5); “It is located on the border between Sagarmatha Zone, Nepal, and Tibet, China and is part of the Himalayan Mountain Range.” (0.5); “Everest (29,035 ft) is the highest mountain in the world and is part of the Himalayan Mountain chain running along the border between Nepal and Tibet (China).” (0.5).

**Final answer/refusal:** Annapurna is a section of the Himalayas in north-central Nepal.

### G33 — K: Other

**Query:** Who is the current president of India?

**Language:** en. **Embedding:** success. **Counts:** dense 24, BM25 24, RRF 3.

**Top scores:** dense: 0.79674; BM25: 3.33988; RRF: 0.0328. **Reranker/context/grounding:** 0.3333333333333333 / 0.3333333333333333 / 0.496.

> Theodore Roosevelt changed the public’s perception of the presidency by asserting the centrality of the office in American government. The president is chosen by the whole nation, not just a district or state, and therefore the office of…

**Extractive candidates:** “The president is chosen by the whole nation, not just a district or state, and therefore the office of the president is the most important office in the federal government.” (0.3333333333333333); “The President’s Constituents.” (0.3333333333333333); “The President and the Media.” (0.3333333333333333).

**Final answer/refusal:** The president is chosen by the whole nation, not just a district or state, and therefore the office of the president is the most important office in the federal government.

### G34 — K: Other

**Query:** What causes earthquakes?

**Language:** en. **Embedding:** success. **Counts:** dense 24, BM25 24, RRF 3.

**Top scores:** dense: 0.84275; BM25: 3.50801; RRF: 0.02991. **Reranker/context/grounding:** 0.5 / 0.5 / 0.599.

> Infections. Infections can cause localized changes in skin color. Cuts and scrapes can develop infections that turn the surrounding skin red or white and change the texture of the skin. Erythrasma is a chronic skin infection caused by ba…

**Extractive candidates:** “Erythrasma is a chronic skin infection caused by bacteria that causes pink skin with brownish flaky patches and wrinkling.” (0.5); “Many people confuse correlation (things happening together or in sequence) for causation (that one thing actually causes the other to happen).” (0.5); “There are numerous potential causes of fatigue as a major complaint.” (0.5).

**Final answer/refusal:** Erythrasma is a chronic skin infection caused by bacteria that causes pink skin with brownish flaky patches and wrinkling.

## Smallest changes suggested by the measured gateway trace

Preserve the current no-LLM architecture. Prioritize only the category counts above: add deterministic aliases for repeatable multilingual query variants, correct any language filter only when its traces exclude expected results, and calibrate context/grounding only for cases where the correct Qdrant candidate is already present but rejected. Do not lower global grounding thresholds to mask coverage gaps.

