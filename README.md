# HH Goa Voice RAG

This project is a voice-driven, non-generative, extractive RAG system over `ai4bharat/MSMARCO-XI`. The browser and managed web application remain lightweight. The optional full-corpus path uses a separately deployed Qdrant service and retrieval gateway; no corpus vectors or gateway credential are exposed to the frontend.

## Two operating modes

| Mode | Corpus | Purpose |
|---|---|---|
| `compact_local` | Bundled validation demonstration slice | Works immediately in the managed web application and remains the safe fallback. |
| `external_gateway` | Real Qdrant collection | Activated only when `CORPUS_RETRIEVAL_URL` and `CORPUS_RETRIEVAL_TOKEN` are configured. |

## Retrieval path

`STT → deterministic guardrails → multilingual dense embedding + BM25 sparse embedding → Qdrant hybrid query + RRF → lightweight sentence reranking → context sufficiency → extractive answer → grounding check → response`

No generative answer model or general-knowledge fallback is used. A question with insufficient evidence receives a refusal.

## Build a real validation index

Run the indexer on the same host as Qdrant, never in the web application container.

```bash
python3 -m pip install pyarrow fastembed httpx
QDRANT_URL=http://127.0.0.1:6333 \
python3 scripts/build_hinval_qdrant_index.py \
  --source /data/hinval.parquet \
  --collection msmarco_xi_hi_v1 \
  --max-records 100000
```

The command reports actual indexed point count, source rows, elapsed time, and model names. Increase `--max-records` only after measuring memory, disk, answer quality, and p95 latency.

### Verified local capacity milestone

The current development environment completed a **real** Hindi validation collection named `msmarco_xi_hi_1k_v1`. It ingested **1,001 source rows** into **1,034 Qdrant points** using `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions) and `Qdrant/bm25`, in **215.8 seconds** with low-memory batches of eight passages. A 20-query benchmark against this collection returned evidence for all 20 sampled source queries with HTTP p50/p70/p95/p99/p100 of **98.682 / 101.909 / 132.806 / 201.839 / 201.839 ms**.

This is a temporary local validation deployment, not a public full-corpus service. The managed web app remains public in compact mode until a persistent host with adequate storage and memory is available for the gateway and a larger collection.

The next 2,000-source-row local expansion was terminated by the sandbox after 376 points, so `msmarco_xi_hi_1k_v1` is the largest **completed and benchmarked** local collection in this environment.

## Run the gateway host

```bash
cd deploy
export GATEWAY_TOKEN="generate-a-long-random-secret"
docker compose -f docker-compose.retrieval.yml up -d --build
```

Set `CORPUS_RETRIEVAL_URL=https://your-host/v1/retrieve` and the matching `CORPUS_RETRIEVAL_TOKEN` in the web app only after the gateway health check and index-status endpoint report the real collection state.

### Existing Qdrant collection compatibility

The gateway accepts named dense vectors plus optional Qdrant sparse/BM25 vectors by default. For the supplied `msmarco_xi` backup, use the actual collection settings: `QDRANT_COLLECTION=msmarco_xi`, `QDRANT_DENSE_VECTOR_NAME=` (empty for its unnamed vector), `QDRANT_ENABLE_SPARSE=false`, `PAYLOAD_TEXT_FIELD=text`, and `PAYLOAD_DOCUMENT_ID_FIELD=chunk_id`. The restored collection contains 149,456 points, 147,000 indexed HNSW vectors, 384-dimensional cosine vectors, and payload fields `chunk_id`, `text`, `strategy`, `metadata.doc_id`, and `token_count`.

> The archive does not record the embedding-model name. The query encoder **must match the model used to create its 384-dimensional vectors**; otherwise semantically unrelated answers can rank highly even when the Qdrant schema is correct. Until that model is identified, dense-only retrieval applies a conservative `MIN_DENSE_SCORE=0.28` floor and refuses low-confidence results instead of returning a different answer.

The supplied backup was restored successfully for inspection: `msmarco_xi` has 149,456 points and 147,000 HNSW-indexed vectors. It does **not** contain its original encoder metadata or explicit dataset/split provenance. The gateway labels provenance as unverified rather than fabricating it. See `docs/user-qdrant-backup-audit.md` for the exact verified payload schema, local restore result, and the required encoder information.

## Benchmarking

The UI retains its controlled compact-corpus benchmark. For the real gateway, measure P50/P70/P95/P99/P100 over a mixed workload, separately reporting STT, gateway retrieval, persistence, and complete HTTP timing. Do not claim full-corpus performance until the real deployed gateway is measured.
