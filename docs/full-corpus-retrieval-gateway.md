# Full-Corpus Retrieval Gateway Plan

## Purpose

The public web application must remain lightweight. It should never download, hold, or index the full `ai4bharat/MSMARCO-XI` corpus. The upstream dataset is approximately 55.6 GB and contains more than 11 million rows; the application currently uses an honest compact validation slice for this reason.[^dataset]

The **retrieval gateway** is a separate server-side service that owns the full corpus index. It receives a question, creates a non-generative query embedding, performs hybrid dense and sparse retrieval, fuses candidates with Reciprocal Rank Fusion (RRF), and returns source passages with stage timings. The web application's existing backend remains responsible for deterministic guardrails, extractive answer selection, presentation, and query-history persistence.

> A retrieval gateway is not a Manus-managed product that appears automatically. Manus can host the web application and can help build the gateway code, but a full Qdrant deployment needs either a managed Qdrant cluster or a separately hosted machine/container with sufficient storage and memory.

## Current Project Reality

The restored repository does **not** contain Qdrant, BM25, FastEmbed, a Docker deployment, or a retrieval gateway. Its present hybrid retrieval is a compact in-memory feature-hash cosine scorer plus lexical token matching and RRF. That is appropriate for the seven-record demonstration corpus but is not a full-corpus service.

## Recommended Submission Strategy

Keep the existing compact in-memory path active as the verified demonstration mode. Build the retrieval-gateway interface behind a feature flag and first prove it with a reproducible Hindi validation shard. This protects the working demo while providing a credible, scalable extension path.

| Option | Best use | Advantages | Limitation |
|---|---|---|---|
| Compact in-app demo | Submission demonstration now | Existing measured retrieval path is very fast and requires no external dependency. | Deliberately narrow coverage. |
| Local Qdrant + BM25 | Development or an in-person local demo | No separate managed service required; easy to inspect. | The machine must remain online and reachable; it is not suitable for a published submission link unless deployed separately. |
| Managed Qdrant, same region as API | Public full-corpus deployment | Durable endpoint, operational monitoring, better availability, and low same-region network latency. | Requires a hosted cluster and endpoint credentials. |
| Docker Qdrant on a dedicated server | Full control | Qdrant, gateway, and embedding model can be co-located. | Requires a persistent machine, Docker, patching, snapshots, and capacity management. |

For an HH Goa submission, the lowest-risk approach is **compact demo mode + reproducible gateway/indexing path**. Switch the live app to the external corpus only after its p95 latency and grounding quality are measured on the real deployment.

## Retrieval API Contract

The application expects one authenticated HTTPS endpoint. The gateway should own query embedding and vector search; this avoids exposing embeddings or corpus credentials to the browser.

### Request

```http
POST /v1/retrieve
Authorization: Bearer <CORPUS_RETRIEVAL_TOKEN>
Content-Type: application/json
```

```json
{
  "query": "How fast does an eagle travel?",
  "language": "auto",
  "limit": 3,
  "minGroundingScore": 0.16,
  "indexVersion": "msmarco-xi-hi-v1"
}
```

### Response

```json
{
  "indexVersion": "msmarco-xi-hi-v1",
  "matches": [
    {
      "id": "233826-fixed_overlap-0",
      "documentId": "233826",
      "language": "hi",
      "strategy": "fixed_overlap",
      "content": "Eagles fly 30 to 55 mph and dive at over 100 mph.",
      "denseScore": 0.83,
      "sparseScore": 7.12,
      "rrfScore": 0.031,
      "source": {
        "dataset": "ai4bharat/MSMARCO-XI",
        "split": "validation",
        "queryId": 233826,
        "passageOrdinal": 0
      }
    }
  ],
  "timings": {
    "queryEmbeddingMs": 18.4,
    "denseSearchMs": 21.6,
    "sparseSearchMs": 14.2,
    "fusionMs": 1.1,
    "totalMs": 58.7
  }
}
```

The web app must refuse if there are no matches, if the best RRF/grounding score is below its threshold, or if the extractive answer cannot be found verbatim in the returned passage text.

## Full-Index Build Steps

### 1. Provision the index environment

Use a dedicated Qdrant deployment in the same geographic region as the web API. Do not run Qdrant inside the existing 512 MB application container. Start with a capacity test rather than assuming a final machine size: one 384-dimensional `float32` vector for every 11.45 million-row dataset record requires about 16.38 GiB before HNSW, sparse index data, metadata, replicas, or chunk expansion. A chunk-per-passage design can be materially larger.

Use fast persistent storage and maintain snapshots. For latency-oriented search, retain the actively searched vectors and indexes in memory when capacity permits. Qdrant documents memory, quantization, and storage trade-offs for this purpose.[^qdrant-performance]

### 2. Stream and normalize the dataset offline

Stream the Hugging Face dataset rather than loading all 55.6 GB into application memory. For every eligible record:

1. Retain the source dataset, split, language, query ID, selected-passage indicator, original English passage, translated passage, and source version.
2. Select only suitable passage records, preferring source-marked selected passages where available.
3. Normalize whitespace and Unicode, then deduplicate using a stable normalized-passage hash.
4. Build fixed-overlap, sentence/semantic, and metadata-aware chunks offline. Preserve the strategy in metadata.
5. Generate dense vectors with a multilingual, non-generative embedding model and generate a sparse/BM25 representation.

### 3. Create a versioned hybrid collection

Create a new collection such as `msmarco_xi_hi_v1` with named dense and sparse vectors plus payload indexes for `language`, `dataset`, `split`, and `strategy`. Upload points in batches, wait for indexing to complete, run a held-out validation suite, snapshot the collection, and only then promote the version.

Qdrant supports dense and sparse prefetch searches with RRF fusion, which is the appropriate hybrid retrieval building block for this system.[^qdrant-hybrid]

### 4. Run a separate retrieval gateway

Deploy a small HTTP service next to Qdrant. Its online responsibilities are limited to query normalization, a warm multilingual embedding call, a single hybrid Qdrant query, RRF, metadata filtering, and returning source passages. It does not generate answers.

Keep a readiness endpoint (`GET /healthz`) and a collection-version endpoint (`GET /v1/index-status`). The app should use its compact local corpus only when gateway mode is intentionally disabled; it should not silently fall back when a configured production gateway is unhealthy.

### 5. Connect the web application

After the gateway is online, set these server-only environment variables in the web project:

| Variable | Meaning |
|---|---|
| `CORPUS_RETRIEVAL_URL` | Full HTTPS URL of `POST /v1/retrieve`. |
| `CORPUS_RETRIEVAL_TOKEN` | Gateway bearer token; never expose it in frontend code. |

The web app can then select the external corpus provider, display the returned source trace and index version, and retain its deterministic refusal and safety behavior.

## Latency Validation Plan

The 200 ms objective must be a measured p95 target, not an assumption. Measure server processing separately from browser and variable STT network latency.

| Online stage | Suggested p95 budget | Measurement |
|---|---:|---|
| Input validation and guardrails | 5 ms | Web API stage timer |
| Query embedding | 35 ms | Gateway timer |
| Dense + sparse Qdrant search | 60 ms | Gateway timer |
| RRF, evidence check, and extraction | 20 ms | Gateway + web API timer |
| Same-region transport and response serialization | 50 ms | End-to-end request timer |
| **Target text-query p95** | **<200 ms** | 1,000-query mixed workload |

Run each benchmark with cold and warm caches, record p50/p95/p99, sample out-of-corpus and unsafe queries, and audit that every answer appears in a returned passage. Do not count external STT network time in the text retrieval SLA; display it separately.

## What to Build First

1. A 100,000–500,000 record Hindi validation shard using the exact contract above.
2. A reproducible offline ingestion command and a manifest containing record count, dedupe count, model ID, index version, and source hashes.
3. A gateway benchmark proving grounded answer quality and p95 latency.
4. A full-corpus job only after the sample shard establishes actual capacity and quality.

[^dataset]: [AI4Bharat MSMARCO-XI Dataset](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
[^qdrant-hybrid]: [Qdrant Hybrid and Multi-Stage Queries](https://qdrant.tech/documentation/search/hybrid-queries/)
[^qdrant-performance]: [Qdrant Performance Optimization](https://qdrant.tech/documentation/ops-optimization/optimize/)
