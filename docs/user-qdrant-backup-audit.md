# User Qdrant Backup Audit

## Verified restore

The supplied `qdrant_backup.tar.gz` archive was downloaded from the user-provided Drive link and restored into an isolated local Qdrant process. The archive contains Qdrant storage only; no code from the archive was executed.

| Field | Verified value |
|---|---|
| Collection | `msmarco_xi` |
| Points | 149,456 |
| HNSW-indexed vectors | 147,000 |
| Vector configuration | Unnamed, 384-dimensional, cosine distance |
| HNSW | `m=16`, `ef_construct=100` |
| Sample payload | `chunk_id`, `text`, `strategy`, `metadata.doc_id`, `token_count` |
| Sparse/BM25 vector | Not present in the collection configuration |
| Dataset and split provenance | Not present in the collection configuration or sample payload; intentionally shown as unverified by the gateway unless supplied separately |

## Gateway adaptation

The gateway now supports this schema without moving vectors into the web app. Its user-collection configuration is:

```text
QDRANT_COLLECTION=msmarco_xi
QDRANT_DENSE_VECTOR_NAME=
QDRANT_ENABLE_SPARSE=false
PAYLOAD_TEXT_FIELD=text
PAYLOAD_DOCUMENT_ID_FIELD=chunk_id
MIN_DENSE_SCORE=0.28
```

The empty vector-name setting is intentional: the collection uses Qdrant's unnamed dense-vector slot.

## Grounding result

The reported prompt `मेरा नाम क्या है?` now returns **zero matches** through the adapted gateway. That is the correct behavior: the corpus has no authenticated evidence of the user's name, so the product must refuse instead of presenting an unrelated chunk.

## Critical missing metadata

The backup itself does not contain the embedding model name. The user-supplied indexing implementation resolves this: it used the non-generative `intfloat/multilingual-e5-small` model through a local SentenceTransformers or FastEmbed backend and passed raw text to both document and query encoders—no E5 `query:` or `passage:` prefix was applied by that code. A direct stored-vector comparison confirms this exact local SentenceTransformers configuration: re-encoding a stored passage produced cosine similarity **1.0** to its own stored vector. The former gateway encoder, `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, produced **0.073745**, proving it was incompatible.

The gateway is now configured to use the recovered non-generative E5 encoder for this collection. It retains the conservative dense-only score floor so unsupported questions remain refusals rather than unrelated answers.

## Required final input

The recovered settings are `EMBEDDING_BACKEND=sentence-transformers`, `DENSE_MODEL=intfloat/multilingual-e5-small`, and `QUERY_PREFIX=`. This resolves the vector-space blocker.

## Grounded retrieval and benchmark result

With the recovered encoder configuration, the factual Hindi question `मैनहट्टन परियोजना क्या है?` retrieved the correct Manhattan Project evidence. The top stored chunk had a dense cosine score of **0.901169**, and its evidence text states that the project was a Second World War research and development undertaking that created the first nuclear weapons. The unsupported question `मेरा नाम क्या है?` returned zero evidence matches.

After warm-up, 20 repeated factual requests against the locally restored 149,456-point collection measured HTTP **P50 54.627 ms**, **P70 55.667 ms**, **P95 65.141 ms**, **P99 65.933 ms**, and **P100 65.933 ms**. This validates the local gateway path, not public-network or STT latency.
