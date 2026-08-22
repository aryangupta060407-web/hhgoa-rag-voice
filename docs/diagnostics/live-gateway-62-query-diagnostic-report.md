# Live Qdrant Hybrid Retrieval Coverage Diagnosis

## Scope

This report executed 54 typed English, Hindi, and Marathi queries against the **live external gateway** backed by msmarco_xi_hi_en_mr_v1. Every request used real multilingual E5 dense embeddings, Qdrant BM25 sparse search, RRF fusion, deterministic sentence reranking, context sufficiency, and extractive grounding. No LLM was used. The answerable cases use verified selected corpus passages with source query IDs 1185869, 1185868, and 150905 in all three languages.

## Results

| Metric | Result |
|---|---:|
| Queries | 54 |
| Correct evidence answers / all queries | 25 / 54 (46.3%) |
| Answerable-case success rate | 25 / 27 (92.6%) |
| Refusals / all queries | 26 / 54 (48.1%) |
| Unsupported-query refusal rate | 88.9% |
| Retrieval recall@3 among known answerable cases | 100.0% |
| Expected-answerable cases | 27 |

## Failure categories

| Category | Meaning | Count |
|---|---|---:|
| I | Grounding threshold too strict | 2 |
| K | Other | 3 |

## Ten representative failures with real passages and scores

### G21 — I: Grounding threshold too strict

**Query:** What work history is generally needed for SSDI?

**Language:** en. **Embedding:** success. **Counts:** dense 96, BM25 96, RRF 12.

**Top scores:** dense: 0.84924; BM25: 7.9202; RRF: 0.03205. **Reranker/context/grounding:** 0 / 0 / 0.

> Generally, you need 10 years of work in a job in which you pay Social Security taxes to be eligible for retirement benefits. You can apply for these benefits as early as age 62 or as late as age 70, with the monthly amount going up the l…

**Extractive candidates:** none.

**Final answer/refusal:** refusal

### G27 — I: Grounding threshold too strict

**Query:** एसएसडीआयसाठी कोणता कामाचा इतिहास आवश्यक आहे?

**Language:** mr. **Embedding:** success. **Counts:** dense 96, BM25 96, RRF 12.

**Top scores:** dense: 0.84947; BM25: 29.35743; RRF: 0.03227. **Reranker/context/grounding:** 0 / 0 / 0.

> सामाजिक सुरक्षा अपंगत्व लाभांचे पाच प्रमुख प्रकार आहेत. सामाजिक सुरक्षा अपंगत्व विमा लाभ (एस.एस.डी.आय.) हा सामाजिक सुरक्षा अपंगत्व लाभांचा सर्वात महत्त्वाचा प्रकार आहे. हे अलीकडील वर्षांत (बहुतेक प्रकरणांमध्ये गेल्या १० वर्षांपैकी पाच) क…

**Extractive candidates:** none.

**Final answer/refusal:** refusal

### G36 — K: Other

**Query:** What is photosynthesis?

**Language:** en. **Embedding:** success. **Counts:** dense 96, BM25 4, RRF 12.

**Top scores:** dense: 0.86296; BM25: 2.74484; RRF: 0.03333. **Reranker/context/grounding:** 1 / 1 / 1.

> Phloem is a conductive (or vascular) tissue found in plants. Phloem carries the products of photosynthesis (sucrose and glucose) from the leaves to other parts of the plant.

**Extractive candidates:** “Phloem carries the products of photosynthesis (sucrose and glucose) from the leaves to other parts of the plant.” (1); “Phloem carries the products of photosynthesis (sucrose and glucose) from the leaves to other parts of the plant.” (1); “Phloem carries the products of photosynthesis (sucrose and glucose) from the leaves to other parts of the plant.” (1).

**Final answer/refusal:** Phloem carries the products of photosynthesis (sucrose and glucose) from the leaves to other parts of the plant.

### G45 — K: Other

**Query:** प्रकाश संश्लेषण क्या है?

**Language:** hi. **Embedding:** success. **Counts:** dense 96, BM25 96, RRF 12.

**Top scores:** dense: 0.84885; BM25: 28.84179; RRF: 0.02895. **Reranker/context/grounding:** 1 / 1 / 0.967.

> फ्लोएम पौधों में पाया जाने वाला एक संवाहक (या संवहनी) ऊतक है। फ्लोएम पत्तियों से पौधे के अन्य भागों तक प्रकाश संश्लेषण (सुक्रोज और ग्लूकोज) के उत्पादों को ले जाता है।

**Extractive candidates:** “फ्लोएम पौधों में पाया जाने वाला एक संवाहक (या संवहनी) ऊतक है। फ्लोएम पत्तियों से पौधे के अन्य भागों तक प्रकाश संश्लेषण (सुक्रोज और ग्लूकोज) के उत्पादों को ले जाता है।” (1); “जाइलम पौधे के विभिन्न भागों में जड़ों से पानी और घुलनशील खनिज पोषक तत्वों का परिवहन करता है। यह वाष्पोत्सर्जन और प्रकाश संश्लेषण के माध्यम से खोए हुए पानी को प्रतिस्थापित करने के लिए जिम्मेदार है। फ्लोएम पौधों के प्रकाश संश्लेषण क्षेत्रो…” (1); “मैग्नीशियम पौधों और मिट्टी में एक आवश्यक पौष्टिक तत्व है। पौधों के कई कार्यों में इसकी व्यापक भूमिकाएँ हैं। मैग्नीशियम की प्रसिद्ध भूमिकाओं में से एक प्रकाश संश्लेषण प्रक्रिया में है, क्योंकि यह क्लोरोफिल का एक निर्माण खंड है, जो पत्तियो…” (1).

**Final answer/refusal:** फ्लोएम पौधों में पाया जाने वाला एक संवाहक (या संवहनी) ऊतक है। फ्लोएम पत्तियों से पौधे के अन्य भागों तक प्रकाश संश्लेषण (सुक्रोज और ग्लूकोज) के उत्पादों को ले जाता है।

### G54 — K: Other

**Query:** प्रकाशसंश्लेषण म्हणजे काय?

**Language:** mr. **Embedding:** success. **Counts:** dense 96, BM25 96, RRF 12.

**Top scores:** dense: 0.8428; BM25: 26.60224; RRF: 0.03229. **Reranker/context/grounding:** 1 / 1 / 0.936.

> पानांमधून प्रकाशसंश्लेषणाची उत्पादने (सुक्रोज आणि ग्लुकोज) फ्लोअमद्वारे प्रकल्पित होतात आणि ते वनस्पतीच्या इतर भागांमध्ये पोहोचतात. मुळांमधून पाणी आणि खनिजे प्रवाहित करणारी संबंधित प्रणाली झायलेम म्हणून ओळखली जाते.

**Extractive candidates:** “मेलॅनिन अतिनील प्रकाश शोषून शरीराचे संरक्षण करते. हायपोपिगमेंटेशन म्हणजे शरीर पुरेसे मेलॅनिन तयार करत नाही.” (1).

**Final answer/refusal:** मेलॅनिन अतिनील प्रकाश शोषून शरीराचे संरक्षण करते. हायपोपिगमेंटेशन म्हणजे शरीर पुरेसे मेलॅनिन तयार करत नाही.

## Smallest changes suggested by the measured gateway trace

Preserve the current no-LLM architecture. Prioritize only the category counts above: add deterministic aliases for repeatable multilingual query variants, correct any language filter only when its traces exclude expected results, and calibrate context/grounding only for cases where the correct Qdrant candidate is already present but rejected. Do not lower global grounding thresholds to mask coverage gaps.

