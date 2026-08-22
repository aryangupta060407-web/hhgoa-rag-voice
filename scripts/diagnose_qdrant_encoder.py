"""Read-only diagnostic for matching an existing Qdrant collection to a query encoder."""
import argparse
import json
import os

import httpx
from fastembed import TextEmbedding


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--model", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    parser.add_argument("--collection", default="msmarco_xi")
    parser.add_argument("--qdrant-url", default=os.environ.get("QDRANT_URL", "http://127.0.0.1:6333"))
    parser.add_argument("--vector-name", default="")
    args = parser.parse_args()

    model = TextEmbedding(model_name=args.model)
    vector = list(model.embed([args.query]))[0].tolist()
    body = {"query": vector, "limit": 5, "with_payload": True}
    if args.vector_name:
        body["using"] = args.vector_name
    response = httpx.post(f"{args.qdrant_url.rstrip('/')}/collections/{args.collection}/points/query", json=body, timeout=10)
    response.raise_for_status()
    points = response.json()["result"]["points"]
    print(json.dumps({"model": args.model, "query": args.query, "matches": [{"id": point["id"], "score": point["score"], "chunkId": point.get("payload", {}).get("chunk_id"), "text": point.get("payload", {}).get("text", "")[:260]} for point in points]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
