import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastembed import SparseTextEmbedding, TextEmbedding
from pydantic import BaseModel, Field

QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant:6333").rstrip("/")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
GATEWAY_TOKEN = os.environ.get("GATEWAY_TOKEN", "")
COLLECTION = os.environ.get("QDRANT_COLLECTION", "msmarco_xi_hi_v1")
DENSE_MODEL = os.environ.get("DENSE_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
SPARSE_MODEL = os.environ.get("SPARSE_MODEL", "Qdrant/bm25")
RRF_K = 60
UNSAFE_PATTERNS = [
    re.compile(r"\b(?:build|make|buy)\s+(?:a\s+)?(?:bomb|explosive|weapon)\b", re.I),
    re.compile(r"\b(?:kill|harm)\s+(?:myself|yourself|someone)\b", re.I),
    re.compile(r"\b(?:suicide|self[- ]harm)\b", re.I),
]

app = FastAPI(title="HH Goa Retrieval Gateway", version="1.0.0")
dense_model = TextEmbedding(model_name=DENSE_MODEL)
sparse_model = SparseTextEmbedding(model_name=SPARSE_MODEL)


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=2, max_length=600)
    language: str = "auto"
    limit: int = Field(default=3, ge=1, le=10)
    minGroundingScore: float = Field(default=0.16, ge=0, le=1)
    indexVersion: str | None = None


def ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 3)


def normalize(value: str) -> str:
    return " ".join(value.strip().split())


def tokens(value: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9\u0900-\u097F]+", normalize(value).lower())


def qdrant_headers() -> dict[str, str]:
    return {"api-key": QDRANT_API_KEY} if QDRANT_API_KEY else {}


def require_auth(authorization: str | None) -> None:
    if not GATEWAY_TOKEN:
        return
    if authorization != f"Bearer {GATEWAY_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid gateway token")


def score_sentence(sentence: str, query: str) -> float:
    query_tokens = tokens(query)
    sentence_tokens = set(tokens(sentence))
    return sum(token in sentence_tokens for token in query_tokens) / max(1, len(query_tokens))


def best_sentence(content: str, query: str) -> tuple[str, float]:
    sentences = [part.strip() for part in re.findall(r"[^.!?]+[.!?]?", content) if part.strip()] or [content]
    return max(((sentence, score_sentence(sentence, query)) for sentence in sentences), key=lambda item: item[1])


async def qdrant_query(vector: list[float], sparse: Any, limit: int) -> tuple[list[dict], list[dict], float, float]:
    payload = {
        "prefetch": [
            {"query": vector, "using": "dense", "limit": max(20, limit * 8), "with_payload": True},
            {"query": {"indices": sparse.indices.tolist(), "values": sparse.values.tolist()}, "using": "bm25", "limit": max(20, limit * 8), "with_payload": True},
        ],
        "query": {"rrf": {"k": RRF_K}},
        "limit": limit,
        "with_payload": True,
    }
    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=4.0) as client:
        response = await client.post(f"{QDRANT_URL}/collections/{COLLECTION}/points/query", headers=qdrant_headers(), json=payload)
    elapsed = ms(start)
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail=f"Qdrant returned {response.status_code}: {response.text[:240]}")
    return response.json()["result"]["points"], [], elapsed, 0.0


@app.get("/healthz")
async def healthz():
    async with httpx.AsyncClient(timeout=2.0) as client:
        response = await client.get(f"{QDRANT_URL}/healthz", headers=qdrant_headers())
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Qdrant is unavailable")
    return {"status": "ok", "collection": COLLECTION, "denseModel": DENSE_MODEL, "sparseModel": SPARSE_MODEL}


@app.get("/v1/index-status")
async def index_status(authorization: str | None = Header(default=None)):
    require_auth(authorization)
    async with httpx.AsyncClient(timeout=3.0) as client:
        response = await client.get(f"{QDRANT_URL}/collections/{COLLECTION}", headers=qdrant_headers())
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Collection is unavailable")
    result = response.json()["result"]
    return {"indexVersion": COLLECTION, "pointsCount": result.get("points_count", 0), "vectorsCount": result.get("vectors_count", 0), "status": result.get("status", "unknown")}


@app.post("/v1/retrieve")
async def retrieve(request: RetrievalRequest, authorization: str | None = Header(default=None)):
    require_auth(authorization)
    query = normalize(request.query)
    if any(pattern.search(query) for pattern in UNSAFE_PATTERNS):
        raise HTTPException(status_code=400, detail="Unsafe request")

    embedding_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=2) as executor:
        dense_future = executor.submit(lambda: list(dense_model.embed([f"query: {query}"]))[0].tolist())
        sparse_future = executor.submit(lambda: list(sparse_model.embed([query]))[0])
        dense_vector, sparse_vector = dense_future.result(), sparse_future.result()
    query_embedding_ms = ms(embedding_start)

    points, _, hybrid_search_ms, _ = await qdrant_query(dense_vector, sparse_vector, request.limit)
    rerank_start = time.perf_counter()
    matches = []
    for point in points:
        payload = point.get("payload", {})
        content = payload.get("content", "")
        sentence, coverage = best_sentence(content, query)
        if not sentence or coverage < request.minGroundingScore:
            continue
        matches.append({
            "id": str(point["id"]),
            "documentId": str(payload.get("queryId", "")),
            "language": payload.get("language", "hi"),
            "strategy": payload.get("strategy", "selected_passage"),
            "content": content,
            "denseScore": float(point.get("score", 0.0)),
            "sparseScore": 0.0,
            "rrfScore": float(point.get("score", 0.0)),
            "source": {"dataset": payload.get("dataset", "ai4bharat/MSMARCO-XI"), "split": payload.get("split", "validation"), "queryId": payload.get("queryId"), "passageOrdinal": payload.get("passageOrdinal")},
        })
    fusion_ms = ms(rerank_start)
    return {"indexVersion": COLLECTION, "matches": matches, "timings": {"queryEmbeddingMs": query_embedding_ms, "denseSearchMs": hybrid_search_ms, "sparseSearchMs": hybrid_search_ms, "fusionMs": fusion_ms, "totalMs": round(query_embedding_ms + hybrid_search_ms + fusion_ms, 3)}}
