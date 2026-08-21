"""Benchmark a deployed retrieval gateway using real MSMARCO-XI validation queries."""
import argparse
import json
import math
import os
import statistics
import time

import httpx
import pyarrow.parquet as pq


def percentile(values, percentage):
    ordered = sorted(values)
    if not ordered:
        return 0.0
    return round(ordered[max(0, math.ceil((percentage / 100) * len(ordered)) - 1)], 3)


def report(values):
    return {f"p{point}": percentile(values, point) for point in (50, 70, 95, 99, 100)} | {"sampleSize": len(values), "mean": round(statistics.mean(values), 3)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--gateway-url", default=os.environ.get("GATEWAY_URL", "http://127.0.0.1:8080/v1/retrieve"))
    parser.add_argument("--token", default=os.environ.get("GATEWAY_TOKEN", ""))
    parser.add_argument("--count", type=int, default=20)
    args = parser.parse_args()
    queries = []
    for batch in pq.ParquetFile(args.source).iter_batches(batch_size=128):
        for row in batch.to_pylist():
            query = str(row.get("Eng_Query") or row.get("query") or "").strip()
            if query:
                queries.append(query)
            if len(queries) >= args.count:
                break
        if len(queries) >= args.count:
            break
    if not queries:
        raise RuntimeError("No source queries found")
    headers = {"authorization": f"Bearer {args.token}"} if args.token else {}
    http_ms, embedding_ms, search_ms, fusion_ms = [], [], [], []
    matched = 0
    with httpx.Client(timeout=10.0, headers=headers) as client:
        for query in queries:
            started = time.perf_counter()
            response = client.post(args.gateway_url, json={"query": query, "limit": 3, "minGroundingScore": 0.16})
            elapsed = (time.perf_counter() - started) * 1000
            response.raise_for_status()
            body = response.json()
            timings = body["timings"]
            http_ms.append(elapsed)
            embedding_ms.append(timings["queryEmbeddingMs"])
            search_ms.append(timings["denseSearchMs"])
            fusion_ms.append(timings["fusionMs"])
            matched += int(bool(body.get("matches")))
    print(json.dumps({"indexVersion": body["indexVersion"], "sourceQueryCount": len(queries), "matchedQueries": matched, "httpMs": report(http_ms), "queryEmbeddingMs": report(embedding_ms), "hybridSearchMs": report(search_ms), "rerankAndGroundingMs": report(fusion_ms)}, indent=2))


if __name__ == "__main__":
    main()
