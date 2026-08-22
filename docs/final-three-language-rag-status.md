# HH Goa Task 2 — Three-Language Extractive RAG Status

**Status date:** 22 August 2026 (IST). This report distinguishes between the verified local build and the configuration still required for a durable public deployment. It does not claim full-corpus coverage where the available sandbox could not safely complete it.

## 1. Verified deployment facts

| Item | Verified status |
|---|---|
| Web application preview | `https://3000-ixa2chdslsyix2x2mm5jp-5a366316.sg1.manus.computer` (development preview; not a published submission URL) |
| Retrieval gateway | Running and verified locally at `http://127.0.0.1:8080`; no public gateway URL has been provisioned |
| Vector store | Local Qdrant v1.19.0 at `http://127.0.0.1:6333` |
| Active verified collection | `msmarco_xi_hi_en_mr_v1` |
| Answer model | **None.** The answer path is deterministic and extractive; no LLM is called for retrieval, reranking, answer selection, or guardrails. |
| Dense encoder | `intfloat/multilingual-e5-small`, SentenceTransformers backend, raw query/passages with no prefix |
| Sparse encoder | `Qdrant/bm25` via FastEmbed |

## 2. Corpus and actual indexed coverage

The shared corpus assets downloaded from the provided Drive folder contain **49,509 Hindi**, **49,507 English**, and **49,529 Marathi** JSONL source passages. Each row carries `passage_id`, `text`, `source_lang`, `source_query_ids`, and `is_selected`.

The reproducible indexer streams records rather than loading the corpus into memory and preserves the original fields, together with `language`, `content`, chunk ordinal, strategy, and dataset metadata. The first large local build exceeded the sandbox memory envelope and was terminated by the environment. A bounded Marathi continuation then completed successfully. Therefore, the only current index claim is the following measured Qdrant count.

| Language | Indexed Qdrant points | Notes |
|---|---:|---|
| Hindi (`hi`) | 5,103 | Real streamed corpus chunks |
| English (`en`) | 2,193 | Real streamed corpus chunks |
| Marathi (`mr`) | 1,015 | Real streamed corpus chunks |
| **Total** | **8,311** | Named `dense` (384-d cosine) and `bm25` sparse vectors |

> **Coverage limitation:** The verified `8,311`-point collection is a real, three-language Qdrant index but is not the complete 148,545-row corpus. The full build must run on a persistent host with materially more than the approximately 3.8 GiB sandbox memory available here.

## 3. Online answer path

The online path is intentionally non-generative:

```text
STT (Sarvam; Whisper fallback)
  → normalized query and safety/no-evidence prechecks
  → multilingual E5 dense query embedding + BM25 sparse query embedding
  → Qdrant dense and sparse prefetch
  → reciprocal-rank fusion (RRF)
  → deterministic lexical sentence reranking
  → context-sufficiency / grounding coverage test
  → verbatim extractive evidence sentence
  → guardrails, response, and non-blocking query-history persistence
```

The UI now exposes **Auto, हिन्दी, English, and मराठी** corpus choices. A selected language becomes a Qdrant payload filter, so a Marathi query can be restricted to Marathi evidence rather than retrieving from another language. The UI also displays measured language point counts when the external gateway is configured.

## 4. Guardrail validation

The following direct gateway checks returned zero matches without performing embedding or Qdrant retrieval:

| Query | Requested language | Result |
|---|---|---|
| `What is my name?` | English | No evidence |
| `मेरा नाम क्या है?` | Hindi | No evidence |
| `माझे नाव काय आहे?` | Marathi | No evidence |

Representative factual questions about the Manhattan Project returned same-language evidence from the indexed corpus in Hindi, English, and Marathi. The gateway returns only retrieved passage text; it does not synthesize an answer.

## 5. Measured local gateway latency

Benchmark artifact: [`multilingual-gateway-benchmark-local.json`](./multilingual-gateway-benchmark-local.json). The benchmark ran seven rounds of three factual and one unsupported query per language: **84 measured HTTP requests** after three warm-up requests.

| Population | n | P50 | P70 | P95 | P99 | P100 |
|---|---:|---:|---:|---:|---:|---:|
| Factual, all three languages | 63 | 59.337 ms | 62.151 ms | 74.492 ms | 81.240 ms | 81.240 ms |
| English factual | 21 | 58.197 ms | 59.132 ms | 71.780 ms | 74.492 ms | 74.492 ms |
| Hindi factual | 21 | 61.130 ms | 63.425 ms | 76.743 ms | 81.240 ms | 81.240 ms |
| Marathi factual | 21 | 58.939 ms | 60.803 ms | 73.707 ms | 79.800 ms | 79.800 ms |
| Unsupported personal queries, all languages | 21 | 1.274 ms | 1.354 ms | 2.644 ms | 2.644 ms | 2.644 ms |

These are **local gateway HTTP RAG-path measurements**, excluding browser time, external STT network time, and database persistence. In the application, persistence is non-blocking and its timing is stored separately. STT latency is also measured separately as `transcriptionMs` where voice is used.

## 6. Required production configuration

The retrieval gateway is intentionally server-only. Do not expose its bearer token to the browser.

| Scope | Required variable | Value / purpose |
|---|---|---|
| Web app server | `CORPUS_RETRIEVAL_URL` | Public gateway endpoint, for example `https://retrieval.example.org/v1/retrieve` |
| Web app server | `CORPUS_RETRIEVAL_TOKEN` | Same strong secret configured as `GATEWAY_TOKEN` on the gateway |
| Gateway | `QDRANT_URL` | Internal Qdrant URL |
| Gateway | `QDRANT_COLLECTION` | `msmarco_xi_hi_en_mr_v1` |
| Gateway | `GATEWAY_TOKEN` | Long random bearer token |
| Gateway | `DENSE_MODEL` | `intfloat/multilingual-e5-small` |
| Gateway | `EMBEDDING_BACKEND` | `sentence-transformers` |
| Gateway | `QUERY_PREFIX` | Empty string |
| Gateway | `QDRANT_DENSE_VECTOR_NAME` | `dense` |
| Gateway | `QDRANT_ENABLE_SPARSE` | `true` |
| Gateway | `PAYLOAD_TEXT_FIELD` | `content` |
| Gateway | `PAYLOAD_LANGUAGE_FIELD` | `language` |

The repository includes [`deploy/docker-compose.retrieval.yml`](../deploy/docker-compose.retrieval.yml) for Qdrant plus the gateway. It is a deployment blueprint, not a public deployment created by this session.

## 7. Remaining blocker and exact submission path

The current sandbox is temporary and lacks sufficient headroom for full three-language indexing plus a persistent public gateway. This is an infrastructure constraint, not an application-code limitation.

1. Provision a persistent Linux host with sufficient RAM for the Python SentenceTransformers worker, Qdrant, and operating system; **8 GiB or more is the practical minimum** for a reliable full index build.
2. Deploy Qdrant and the gateway using the supplied Compose file, keeping Qdrant private and exposing only the gateway over HTTPS.
3. Copy the three `*_corpus.jsonl` files to that host and run:
   ```bash
   QDRANT_URL=http://127.0.0.1:6333 python3 scripts/build_multilingual_jsonl_qdrant_index.py \
     --source-dir /path/to/multilingual-corpus \
     --collection msmarco_xi_hi_en_mr_v1 \
     --max-records-per-language 0 \
     --batch-size 32
   ```
4. Verify `/v1/index-status` returns the expected full point count and all three language counts.
5. Configure `CORPUS_RETRIEVAL_URL` and `CORPUS_RETRIEVAL_TOKEN` on the web application server, then re-run the included benchmark and capture the production results.
6. Create a project checkpoint, then use the web application's **Publish** control to publish the web UI. The gateway must remain a separately hosted service.

## 8. Verification record

The final local code validation passed **24 tests** (with two intentional live-transcription skips), TypeScript type checking, Python benchmark compilation, direct gateway language-filter checks, factual retrieval checks, and the three-language no-evidence checks.
