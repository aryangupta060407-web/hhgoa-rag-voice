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

The backup does not contain the embedding model name or the exact passage/query prefix convention used to create the vectors. This cannot be inferred reliably from the vector dimension alone. A direct stored-vector comparison showed that the current default encoder does not match the stored space: re-encoding a stored passage with `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` produced cosine similarity **0.073745** to its own stored vector, where a matching encoder should produce a value near 1.0.

Therefore the gateway applies the conservative dense-only score floor and refuses low-confidence results. This eliminates unrelated answers, but it also means factual answers will remain limited until the original encoder is identified.

## Required final input

Please provide the exact model name and the text fed into it when the index was built, for example:

```text
model = ...
document input = text | passage: {text} | another template
query input = query | query: {query} | another template
```

If that information is unavailable, the reliable alternative is to rebuild the 149,456 vectors from the stored `text` payload using a documented multilingual model and then deploy the matching query encoder.
