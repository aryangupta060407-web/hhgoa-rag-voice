# HH Goa Task 2 — Final Status Report

## 1. Deployment facts

| Item | Actual state |
|---|---|
| Managed web application | The lightweight HH Goa Voice RAG application is running in its managed development environment. It remains in `compact_local` mode until a persistent gateway URL and token are configured. |
| Public production application | Not published by this task. A project checkpoint is ready; publication requires the owner to use the project’s **Publish** control. |
| Qdrant | Qdrant **v1.19.0** was started locally during validation. It is temporary and not a persistent public deployment. |
| Retrieval gateway | A real FastAPI gateway was started locally against Qdrant at `http://127.0.0.1:8080`. It is not publicly routable and will not survive sandbox lifecycle events. |

## 2. Actual corpus and index size

The official `validation/hinval.parquet` file from `ai4bharat/MSMARCO-XI` was downloaded and processed. The completed real collection is **`msmarco_xi_hi_1k_v1`**.

| Measurement | Actual value |
|---|---:|
| Source rows streamed | 1,001 |
| Qdrant points indexed | 1,034 |
| Dense vectors | 384-dimensional multilingual embeddings |
| Dense model | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Sparse model | `Qdrant/bm25` |
| Build elapsed time | 215.8 seconds |
| Index provenance | `ai4bharat/MSMARCO-XI`, Hindi validation split |

This is a real reproducible validation index, **not** a claim that the full 55.6 GB / 11M+ upstream corpus is deployed.

An attempted 2,000-source-row expansion was terminated by the sandbox after reaching 376 points; its incomplete collection was removed. This makes the 1,034-point collection the **largest fully completed and benchmarked** local index in the available environment, rather than an untested arbitrary cutoff.

## 3. Implemented retrieval architecture

> `STT → query normalization → safety guardrails → multilingual dense embedding + BM25 sparse embedding → Qdrant hybrid query with RRF → deterministic token-coverage reranking → context sufficiency → extractive sentence answer → grounding verification → response`

The answer path contains **no generative LLM** and no general-knowledge fallback. Query history persistence is non-critical best-effort telemetry outside the user-facing answer path. Controlled compact benchmarks retain awaited persistence when recording database timing.

| Component | Delivered artifact |
|---|---|
| Gateway | `services/retrieval-gateway/app.py` |
| Gateway deployment | `services/retrieval-gateway/Dockerfile` and `deploy/docker-compose.retrieval.yml` |
| Real Parquet indexer | `scripts/build_hinval_qdrant_index.py` |
| Gateway performance harness | `scripts/benchmark_retrieval_gateway.py` |
| Managed-app client | `server/rag/retrievalGateway.ts` |
| UI visibility | Corpus mode, index version, point count, reachability, sources, and timing trace |

## 4. Measured gateway benchmark

The gateway was measured with 20 real source queries from the downloaded Hindi validation shard. All 20 returned at least one evidence match in the 1,034-point collection.

| Metric (ms) | P50 | P70 | P95 | P99 | P100 |
|---|---:|---:|---:|---:|---:|
| Gateway HTTP request | 98.682 | 101.909 | 132.806 | 201.839 | 201.839 |
| Query embedding | 65.146 | 67.130 | 80.075 | 94.164 | 94.164 |
| Hybrid Qdrant search | 29.993 | 30.831 | 40.582 | 117.170 | 117.170 |
| Rerank and grounding | 0.316 | 0.344 | 0.449 | 0.859 | 0.859 |

The measured gateway **P95 is below 200 ms** for this real local 1k index. Its P99/P100 is 201.839 ms, so a strict P99-under-200 claim would be inaccurate. STT and production-network latency were not included in this text-query gateway benchmark and are therefore not reported as fabricated numbers.

## 5. Required web-app secrets after persistent gateway deployment

| Secret | Purpose |
|---|---|
| `CORPUS_RETRIEVAL_URL` | Public HTTPS URL ending in `/v1/retrieve` on the persistent gateway. |
| `CORPUS_RETRIEVAL_TOKEN` | Server-only bearer token shared with `GATEWAY_TOKEN` on the gateway host. |

The app derives the paired `/v1/index-status` endpoint server-side. It never exposes either secret to the browser.

## 6. Remaining infrastructure limitation and final submission steps

The current sandbox has approximately 40 GB local disk and 3.8 GiB RAM, has no Docker runtime, and hibernates after task activity. It cannot host a durable public 55.6 GB Qdrant collection or a public gateway. This is a genuine infrastructure limitation rather than an application-code gap.

To complete production submission: provision a persistent Linux/Docker host or managed Qdrant service; deploy `deploy/docker-compose.retrieval.yml`; run the indexer at 100k, then 500k, then larger only after capacity and p95 checks; set the two server secrets; verify the UI reports the external index version and point count; rerun the benchmark; then publish the checkpointed web application.

## References

[1] [Qdrant Installation Documentation](https://qdrant.tech/documentation/installation/)

[2] [AI4Bharat MSMARCO-XI Dataset](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
