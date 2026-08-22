"""Stream Hindi, English, and Marathi JSONL corpora into a Qdrant hybrid index.

This tool runs outside the web app. It uses the same non-generative
`intfloat/multilingual-e5-small` SentenceTransformers encoder that produced the
restored collection and adds Qdrant BM25 sparse vectors for hybrid RRF search.
"""
import argparse
import hashlib
import json
import os
import time
from collections.abc import Iterator

import httpx
from fastembed import SparseTextEmbedding
from sentence_transformers import SentenceTransformer


LANGUAGES = ("hi", "en", "mr")


def normalize(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def stable_id(language: str, passage_id: str, part: int) -> str:
    digest = hashlib.sha256(f"{language}\n{passage_id}\n{part}".encode("utf-8")).hexdigest()
    return f"{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:32]}"


def fixed_chunks(text: str, max_words: int, overlap_words: int) -> Iterator[str]:
    words = normalize(text).split()
    if not words:
        return
    step = max(1, max_words - overlap_words)
    for start in range(0, len(words), step):
        chunk = " ".join(words[start : start + max_words])
        if chunk:
            yield chunk
        if start + max_words >= len(words):
            break


def corpus_chunks(source_dir: str, languages: tuple[str, ...], max_records: int, max_words: int, overlap_words: int) -> Iterator[dict]:
    for language in languages:
        path = os.path.join(source_dir, f"{language}_corpus.jsonl")
        with open(path, "r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle):
                if max_records and line_number >= max_records:
                    break
                row = json.loads(line)
                passage_id = str(row.get("passage_id") or f"{language}_p_{line_number:06d}")
                for part, content in enumerate(fixed_chunks(str(row.get("text", "")), max_words, overlap_words)):
                    yield {
                        "id": stable_id(language, passage_id, part),
                        "content": content,
                        "payload": {
                            "dataset": "user-shared-processed-corpus",
                            "split": "corpus",
                            "language": str(row.get("source_lang") or language),
                            "source_lang": str(row.get("source_lang") or language),
                            "queryId": passage_id,
                            "passage_id": passage_id,
                            "passageOrdinal": part,
                            "strategy": "fixed",
                            "sourceQueryIds": row.get("source_query_ids") or [],
                            "source_query_ids": row.get("source_query_ids") or [],
                            "isSelected": int(row.get("is_selected", 0)),
                            "is_selected": int(row.get("is_selected", 0)),
                            "contentHash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
                        },
                    }


def batched(items: Iterator[dict], size: int) -> Iterator[list[dict]]:
    batch: list[dict] = []
    for item in items:
        batch.append(item)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch


def api(client: httpx.Client, method: str, url: str, **kwargs) -> dict:
    response = client.request(method, url, **kwargs)
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--collection", default="msmarco_xi_hi_en_mr_v1")
    parser.add_argument("--max-records-per-language", type=int, default=0, help="0 indexes all available records")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--chunk-words", type=int, default=180)
    parser.add_argument("--overlap-words", type=int, default=30)
    parser.add_argument("--languages", default="hi,en,mr")
    args = parser.parse_args()

    qdrant_url = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333").rstrip("/")
    api_key = os.environ.get("QDRANT_API_KEY", "")
    headers = {"api-key": api_key} if api_key else {}
    languages = tuple(language.strip() for language in args.languages.split(",") if language.strip())
    if not languages or any(language not in LANGUAGES for language in languages):
        raise ValueError(f"languages must be a subset of {LANGUAGES}")

    encoder = SentenceTransformer("intfloat/multilingual-e5-small")
    sparse_encoder = SparseTextEmbedding(model_name="Qdrant/bm25")
    started = time.perf_counter()
    indexed = 0
    per_language: dict[str, int] = {language: 0 for language in languages}

    with httpx.Client(headers=headers, timeout=90.0) as client:
        existing = client.get(f"{qdrant_url}/collections/{args.collection}")
        if existing.status_code == 404:
            api(client, "PUT", f"{qdrant_url}/collections/{args.collection}", json={"vectors": {"dense": {"size": 384, "distance": "Cosine"}}, "sparse_vectors": {"bm25": {}}, "on_disk_payload": True})
            for field in ("dataset", "split", "language", "source_lang", "strategy", "isSelected"):
                api(client, "PUT", f"{qdrant_url}/collections/{args.collection}/index", json={"field_name": field, "field_schema": "keyword" if field != "isSelected" else "integer"})
        elif existing.status_code != 200:
            existing.raise_for_status()

        stream = corpus_chunks(args.source_dir, languages, args.max_records_per_language, args.chunk_words, args.overlap_words)
        for batch in batched(stream, args.batch_size):
            contents = [item["content"] for item in batch]
            dense_vectors = encoder.encode(contents, show_progress_bar=False, convert_to_numpy=True)
            sparse_vectors = list(sparse_encoder.embed(contents))
            points = []
            for item, dense, sparse in zip(batch, dense_vectors, sparse_vectors):
                language = item["payload"]["language"]
                per_language[language] = per_language.get(language, 0) + 1
                points.append({"id": item["id"], "vector": {"dense": dense.tolist(), "bm25": {"indices": sparse.indices.tolist(), "values": sparse.values.tolist()}}, "payload": {**item["payload"], "content": item["content"]}})
            api(client, "PUT", f"{qdrant_url}/collections/{args.collection}/points?wait=true", json={"points": points})
            indexed += len(points)
            if indexed % 1000 < len(points):
                print(json.dumps({"collection": args.collection, "indexedPoints": indexed, "perLanguage": per_language, "elapsedSeconds": round(time.perf_counter() - started, 1)}), flush=True)
        result = api(client, "GET", f"{qdrant_url}/collections/{args.collection}")["result"]

    print(json.dumps({"complete": True, "collection": args.collection, "pointsIndexedThisRun": indexed, "pointsCount": result.get("points_count"), "vectorsCount": result.get("vectors_count"), "perLanguage": per_language, "denseModel": "intfloat/multilingual-e5-small", "sparseModel": "Qdrant/bm25", "elapsedSeconds": round(time.perf_counter() - started, 1)}, indent=2))


if __name__ == "__main__":
    main()
