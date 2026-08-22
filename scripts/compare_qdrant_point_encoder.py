"""Compare a stored point vector with a locally encoded copy of its payload text."""
import argparse
import json
import os

import httpx
import numpy as np
from fastembed import TextEmbedding


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--point-id", type=int, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--prefix", default="")
    parser.add_argument("--backend", choices=["fastembed", "sentence-transformers"], default="fastembed")
    parser.add_argument("--collection", default="msmarco_xi")
    parser.add_argument("--qdrant-url", default=os.environ.get("QDRANT_URL", "http://127.0.0.1:6333"))
    args = parser.parse_args()
    response = httpx.get(f"{args.qdrant_url.rstrip('/')}/collections/{args.collection}/points/{args.point_id}", params={"with_payload": "true", "with_vector": "true"}, timeout=10)
    response.raise_for_status()
    point = response.json()["result"]
    stored = np.array(point["vector"], dtype=np.float32)
    text = str(point["payload"].get("text", ""))
    model_input = f"{args.prefix}{text}"
    if args.backend == "sentence-transformers":
        from sentence_transformers import SentenceTransformer
        encoded = np.array(SentenceTransformer(args.model).encode([model_input], show_progress_bar=False, convert_to_numpy=True)[0], dtype=np.float32)
    else:
        encoded = np.array(list(TextEmbedding(model_name=args.model).embed([model_input]))[0], dtype=np.float32)
    cosine = float(np.dot(stored, encoded) / (np.linalg.norm(stored) * np.linalg.norm(encoded)))
    print(json.dumps({"pointId": args.point_id, "backend": args.backend, "model": args.model, "prefix": args.prefix, "dimension": len(stored), "cosine": round(cosine, 6), "text": text[:240]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
