# Reference-Driven Non-LLM RAG Design

The user-provided references establish the design boundary for this project: no autoregressive generation is permitted on the serving path. The deployed demonstration therefore uses deterministic transcription routing, offline index construction, in-memory hybrid retrieval, extractive answer selection, and evidence-backed refusal.

| Reference method | Implementation decision for this project | Reason for the adaptation |
| --- | --- | --- |
| Multi-strategy offline chunking | Build fixed-overlap, sentence/semantic, and metadata-aware chunks before deployment; query requests never chunk the corpus. | Separates index-build cost from online latency while meeting the requested chunking breadth. |
| Hybrid lexical and dense candidate retrieval with reciprocal-rank fusion | Run lexical term matching and deterministic hashed-vector cosine search, then fuse the ranked candidate lists with RRF. | Preserves exact-term matches alongside paraphrase tolerance without any generative model. |
| Coarse-to-fine ranking | Score all compact vectors to form candidates, then rescore only the fused candidates with token-overlap and sentence relevance signals. | Keeps the demo implementation memory-resident and fast under the managed Node runtime. |
| Semantic caching | Keep a bounded in-memory cache keyed by normalized query text and deterministic query signature. | Repeated demonstration queries return immediately while preserving provenance. |
| Extractive neural or graph-based answer selection | Use deterministic sentence scoring based on query coverage, cosine relevance, position, and source relevance; return an evidence sentence verbatim rather than synthesizing text. | Produces grounded, explainable answers without LLM inference or hallucinated wording. |
| Deterministic guardrails | Reject unsafe inputs with a curated blocklist, flag off-topic queries with corpus-domain affinity, and refuse when relevance is below a calibrated threshold. | Makes every refusal interpretable and compatible with the no-LLM constraint. |
| Stage-level latency budgets | Measure cache, guardrails, embedding, dense retrieval, lexical retrieval, RRF, extraction, and persistence independently. The retrieval-to-answer aggregate excludes external STT network time and is shown alongside total request time. | Provides auditable P50, P70, and maximum analytics without conflating variable network transcription latency with local RAG latency. |

The production-scale mechanisms in the references—ONNX/TensorRT inference, HNSW/IVF-PQ, scalar quantization, ColBERT/PLAID, and memory-mapped vector stores—are documented as scale-up paths. They require binaries, model artifacts, or resources outside the managed Node demonstration runtime. The deployed demo instead demonstrates their architectural principles with a compact pre-built in-memory index suitable for live judging.
