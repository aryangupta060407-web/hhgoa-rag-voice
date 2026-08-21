"""Build a real hybrid Qdrant index from ai4bharat/MSMARCO-XI Hindi validation.

Run outside the web application process. Example:
  QDRANT_URL=http://127.0.0.1:6333 python3 scripts/build_hinval_qdrant_index.py \
    --source /data/hinval.parquet --collection msmarco_xi_hi_v1 --max-records 100000
"""
import argparse
import hashlib
import json
import os
import time
from itertools import islice

import httpx
import pyarrow.parquet as pq
from fastembed import SparseTextEmbedding, TextEmbedding


def normalize(value):
    return " ".join(str(value or "").strip().split())


def as_uuid(value):
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:32]}"


def selected_passages(row):
    passages = row.get("passages") or {}
    translated = passages.get("Translated_passages") or []
    english = passages.get("English_passages") or []
    selected = passages.get("is_selected") or []
    candidates = [{"translated": normalize(value), "english": normalize(english[index] if index < len(english) else ""), "selected": bool(selected[index]) if index < len(selected) else False, "ordinal": index} for index, value in enumerate(translated)]
    candidates = [item for item in candidates if item["translated"] or item["english"]]
    chosen = [item for item in candidates if item["selected"]]
    return chosen or candidates[:1]


def chunks(rows):
    for row in rows:
        for passage in selected_passages(row):
            content = normalize(f"{passage['translated']}\n{passage['english']}")
            if not content:
                continue
            yield {
                "id": as_uuid(f"{row.get('target_lang')}\n{content}"),
                "content": content,
                "payload": {
                    "dataset": "ai4bharat/MSMARCO-XI",
                    "split": "validation",
                    "language": row.get("target_lang", "hin_Deva"),
                    "queryId": int(row.get("query_id", 0)),
                    "passageOrdinal": passage["ordinal"],
                    "strategy": "selected_passage",
                    "sourceQuery": normalize(row.get("query")),
                    "sourceEnglishQuery": normalize(row.get("Eng_Query")),
                    "contentHash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
                },
            }


def batches(iterator, size):
    while batch := list(islice(iterator, size)):
        yield batch


def request(client, method, url, **kwargs):
    response = client.request(method, url, **kwargs)
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--collection", default="msmarco_xi_hi_v1")
    parser.add_argument("--max-records", type=int, default=100000)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--model", default=os.environ.get("DENSE_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"))
    parser.add_argument("--sparse-model", default=os.environ.get("SPARSE_MODEL", "Qdrant/bm25"))
    args = parser.parse_args()
    qdrant_url = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333").rstrip("/")
    api_key = os.environ.get("QDRANT_API_KEY", "")
    headers = {"api-key": api_key} if api_key else {}
    dense_model = TextEmbedding(model_name=args.model)
    sparse_model = SparseTextEmbedding(model_name=args.sparse_model)
    dimension = dense_model.embedding_size
    with httpx.Client(timeout=60.0, headers=headers) as client:
        probe = client.get(f"{qdrant_url}/collections/{args.collection}")
        if probe.status_code == 404:
            request(client, "PUT", f"{qdrant_url}/collections/{args.collection}", json={"vectors": {"dense": {"size": dimension, "distance": "Cosine"}}, "sparse_vectors": {"bm25": {}}, "on_disk_payload": True})
            for field in ("dataset", "split", "language", "strategy"):
                request(client, "PUT", f"{qdrant_url}/collections/{args.collection}/index", json={"field_name": field, "field_schema": "keyword"})
        elif probe.status_code != 200:
            probe.raise_for_status()

        parquet = pq.ParquetFile(args.source)
        indexed = 0
        source_rows = 0
        started = time.perf_counter()
        def rows():
            nonlocal source_rows
            # Keep the source reader bounded. A validation row contains ten
            # passages, so large Arrow batches can briefly materialize far more
            # text than the lightweight indexing host should hold at once.
            for row_batch in parquet.iter_batches(batch_size=min(128, max(16, args.batch_size))):
                for row in row_batch.to_pylist():
                    source_rows += 1
                    if args.max_records and source_rows > args.max_records:
                        return
                    yield row

        for batch in batches(chunks(rows()), args.batch_size):
            contents = [item["content"] for item in batch]
            dense_vectors = list(dense_model.embed([f"passage: {content}" for content in contents]))
            sparse_vectors = list(sparse_model.embed(contents))
            points = [{"id": item["id"], "vector": {"dense": dense.tolist(), "bm25": {"indices": sparse.indices.tolist(), "values": sparse.values.tolist()}}, "payload": {**item["payload"], "content": item["content"]}} for item, dense, sparse in zip(batch, dense_vectors, sparse_vectors)]
            request(client, "PUT", f"{qdrant_url}/collections/{args.collection}/points?wait=true", json={"points": points})
            indexed += len(points)
            if indexed % 5000 < len(points):
                print(json.dumps({"indexedPoints": indexed, "sourceRows": source_rows, "elapsedSeconds": round(time.perf_counter() - started, 1), "collection": args.collection}))
        final = request(client, "GET", f"{qdrant_url}/collections/{args.collection}")["result"]
    print(json.dumps({"complete": True, "collection": args.collection, "sourceRows": source_rows, "indexedPoints": indexed, "vectorsCount": final.get("vectors_count"), "pointsCount": final.get("points_count"), "elapsedSeconds": round(time.perf_counter() - started, 1), "denseModel": args.model, "sparseModel": args.sparse_model}, indent=2))


if __name__ == "__main__":
    main()
