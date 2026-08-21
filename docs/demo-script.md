# 90-Second Product Demo Script

Open with the Verity dashboard and say: “This is Verity, a voice-driven RAG system over MSMARCO-XI. It uses no generative LLM; every answer is an extractive sentence from retrieved evidence.”

Record: “How fast does an eagle travel?” Wait for the transcript and point to the answer sentence, its relevance-scored sources, the `passed` guardrail, and the separate STT and RAG timing fields. Then type “Which moon of Neptune has a purple ocean?” and point to the refusal: “The system declines because it cannot ground that answer in the indexed corpus.”

Click **Run 24-query cold benchmark**. Once `population=cold_benchmark` and `n=24` appear, say: “This benchmark resets the semantic cache before each real MSMARCO-XI query. It reports P50, P70, and maximum rather than a single best-case latency.” Close with: “Voice to text, retrieval, grounded extraction, guardrails, persistence, and analytics are all shown end to end.”
