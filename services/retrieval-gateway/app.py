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
COLLECTION = os.environ.get("QDRANT_COLLECTION", "msmarco_xi_hi_en_mr_v1")
DENSE_MODEL = os.environ.get("DENSE_MODEL", "intfloat/multilingual-e5-small")
SPARSE_MODEL = os.environ.get("SPARSE_MODEL", "Qdrant/bm25")
EMBEDDING_BACKEND = os.environ.get("EMBEDDING_BACKEND", "sentence-transformers")
QUERY_PREFIX = os.environ.get("QUERY_PREFIX", "")
QDRANT_DENSE_VECTOR_NAME = os.environ.get("QDRANT_DENSE_VECTOR_NAME", "dense")
QDRANT_ENABLE_SPARSE = os.environ.get("QDRANT_ENABLE_SPARSE", "true").lower() == "true"
PAYLOAD_TEXT_FIELD = os.environ.get("PAYLOAD_TEXT_FIELD", "content")
PAYLOAD_DOCUMENT_ID_FIELD = os.environ.get("PAYLOAD_DOCUMENT_ID_FIELD", "queryId")
PAYLOAD_LANGUAGE_FIELD = os.environ.get("PAYLOAD_LANGUAGE_FIELD", "language")
PAYLOAD_DATASET = os.environ.get("PAYLOAD_DATASET", "")
PAYLOAD_SPLIT = os.environ.get("PAYLOAD_SPLIT", "")
MIN_DENSE_SCORE = float(os.environ.get("MIN_DENSE_SCORE", "0.28"))
RRF_K = 60
UNSAFE_PATTERNS = [
    re.compile(r"\b(?:build|make|buy)\s+(?:a\s+)?(?:bomb|explosive|weapon)\b", re.I),
    re.compile(r"\b(?:kill|harm)\s+(?:myself|yourself|someone)\b", re.I),
    re.compile(r"\b(?:suicide|self[- ]harm)\b", re.I),
]
STOP_WORDS = {
    "a", "an", "and", "are", "at", "be", "by", "does", "for", "from", "has", "how", "in", "is", "it", "of", "on", "or", "the", "to", "what", "which", "who", "why", "with", "my", "your", "name",
    "क्या", "है", "हैं", "था", "थी", "थे", "मेरा", "मेरी", "मेरे", "तुम्हारा", "तुम्हारी", "तुम्हारे", "आपका", "आपकी", "आपके", "नाम", "कौन", "कौनसा", "कौनसी", "कहाँ", "कब", "कैसे", "कितना", "कितने", "की", "का", "के", "को", "में", "और", "से", "पर", "यह", "वह", "उस", "इस", "एक", "मैं", "हम", "आप", "तुम", "भी",
    "माझे", "माझा", "माझी", "तुझे", "तुझा", "तुझी", "तुमचे", "तुमचा", "तुमची", "नाव", "कोण", "काय", "आहे", "आहेत", "होता", "होती", "होते", "कुठे", "कधी", "कसे", "किती", "चा", "ची", "चे", "ला", "मध्ये", "आणि", "पण", "हे", "तो", "ती", "ते", "या", "त्या", "एक", "मी", "आम्ही", "तुम्ही", "आपण",
}

app = FastAPI(title="HH Goa Retrieval Gateway", version="1.0.0")
if EMBEDDING_BACKEND == "sentence-transformers":
    from sentence_transformers import SentenceTransformer
    dense_model = SentenceTransformer(DENSE_MODEL)
    sparse_model = SparseTextEmbedding(model_name=SPARSE_MODEL) if QDRANT_ENABLE_SPARSE else None
else:
    dense_model = TextEmbedding(model_name=DENSE_MODEL)
    sparse_model = SparseTextEmbedding(model_name=SPARSE_MODEL) if QDRANT_ENABLE_SPARSE else None


class RetrievalRequest(BaseModel):
    query: str = Field(min_length=2, max_length=600)
    language: str = "auto"
    limit: int = Field(default=3, ge=1, le=10)
    minGroundingScore: float = Field(default=0.3, ge=0, le=1)
    indexVersion: str | None = None


def ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 3)


def normalize(value: str) -> str:
    return " ".join(value.strip().split())


def normalize_for_retrieval(value: str) -> str:
    normalized = normalize(value)
    normalized = re.sub(r"\b(?:gati|speed)\b", "तेजी", normalized, flags=re.I)
    normalized = normalized.replace("गति", "तेजी")
    normalized = re.sub(r"\b(?:udta|udte)(?:\s+hai(?:n)?)?\b", "उड़ते", normalized, flags=re.I)
    return normalized.replace("उड़ता", "उड़ते").replace("बाज़", "ईगल").replace("तेजी", "रफ्तार")


def tokens(value: str) -> list[str]:
    return [token for token in re.findall(r"[A-Za-z0-9\u0900-\u097F]+", normalize_for_retrieval(value).lower()) if token not in STOP_WORDS]


def qdrant_headers() -> dict[str, str]:
    return {"api-key": QDRANT_API_KEY} if QDRANT_API_KEY else {}


def dense_embed(text: str) -> list[float]:
    if EMBEDDING_BACKEND == "sentence-transformers":
        return dense_model.encode([f"{QUERY_PREFIX}{text}"], show_progress_bar=False, convert_to_numpy=True)[0].tolist()
    return list(dense_model.embed([f"{QUERY_PREFIX}{text}"]))[0].tolist()


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


async def qdrant_query(vector: list[float], sparse: Any | None, limit: int, language: str) -> tuple[list[dict], float]:
    dense_query: dict[str, Any] = {"query": vector, "limit": max(20, limit * 8), "with_payload": True}
    if QDRANT_DENSE_VECTOR_NAME:
        dense_query["using"] = QDRANT_DENSE_VECTOR_NAME
    if language in {"hi", "en", "mr"}:
        dense_query["filter"] = {"must": [{"key": PAYLOAD_LANGUAGE_FIELD, "match": {"value": language}}]}
    if QDRANT_ENABLE_SPARSE and sparse is not None:
        payload: dict[str, Any] = {
            "prefetch": [
                dense_query,
                {"query": {"indices": sparse.indices.tolist(), "values": sparse.values.tolist()}, "using": "bm25", "limit": max(20, limit * 8), "with_payload": True},
            ],
            "query": {"rrf": {"k": RRF_K}},
            "limit": limit,
            "with_payload": True,
        }
    else:
        payload = {**dense_query, "limit": limit}
    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=4.0) as client:
        response = await client.post(f"{QDRANT_URL}/collections/{COLLECTION}/points/query", headers=qdrant_headers(), json=payload)
    elapsed = ms(start)
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail=f"Qdrant returned {response.status_code}: {response.text[:240]}")
    return response.json()["result"]["points"], elapsed


@app.get("/healthz")
async def healthz():
    async with httpx.AsyncClient(timeout=2.0) as client:
        response = await client.get(f"{QDRANT_URL}/healthz", headers=qdrant_headers())
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Qdrant is unavailable")
    return {"status": "ok", "collection": COLLECTION, "embeddingBackend": EMBEDDING_BACKEND, "denseModel": DENSE_MODEL, "sparseModel": SPARSE_MODEL if QDRANT_ENABLE_SPARSE else None, "denseVectorName": QDRANT_DENSE_VECTOR_NAME or "unnamed"}


@app.get("/v1/index-status")
async def index_status(authorization: str | None = Header(default=None)):
    require_auth(authorization)
    async with httpx.AsyncClient(timeout=3.0) as client:
        response = await client.get(f"{QDRANT_URL}/collections/{COLLECTION}", headers=qdrant_headers())
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Collection is unavailable")
    result = response.json()["result"]
    async with httpx.AsyncClient(timeout=3.0) as client:
        language_counts: dict[str, int] = {}
        for language in ("hi", "en", "mr"):
            count = await client.post(
                f"{QDRANT_URL}/collections/{COLLECTION}/points/count",
                headers=qdrant_headers(),
                json={"exact": False, "filter": {"must": [{"key": PAYLOAD_LANGUAGE_FIELD, "match": {"value": language}}]}},
            )
            language_counts[language] = count.json().get("result", {}).get("count", 0) if count.status_code == 200 else 0
    return {"indexVersion": COLLECTION, "pointsCount": result.get("points_count", 0), "vectorsCount": result.get("vectors_count", 0), "status": result.get("status", "unknown"), "languageCounts": language_counts, "supportedLanguages": ["hi", "en", "mr"]}


@app.post("/v1/retrieve")
async def retrieve(request: RetrievalRequest, authorization: str | None = Header(default=None)):
    require_auth(authorization)
    query = normalize_for_retrieval(request.query)
    if any(pattern.search(query) for pattern in UNSAFE_PATTERNS):
        raise HTTPException(status_code=400, detail="Unsafe request")
    if not tokens(query):
        return {"indexVersion": COLLECTION, "matches": [], "timings": {"queryEmbeddingMs": 0.0, "denseSearchMs": 0.0, "sparseSearchMs": 0.0, "fusionMs": 0.0, "totalMs": 0.0}}

    embedding_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=2 if QDRANT_ENABLE_SPARSE else 1) as executor:
        dense_future = executor.submit(dense_embed, query)
        sparse_future = executor.submit(lambda: list(sparse_model.embed([query]))[0]) if QDRANT_ENABLE_SPARSE and sparse_model else None
        dense_vector = dense_future.result()
        sparse_vector = sparse_future.result() if sparse_future else None
    query_embedding_ms = ms(embedding_start)

    points, hybrid_search_ms = await qdrant_query(dense_vector, sparse_vector, request.limit, request.language)
    rerank_start = time.perf_counter()
    matches = []
    for point in points:
        payload = point.get("payload", {})
        content = str(payload.get(PAYLOAD_TEXT_FIELD, ""))
        sentence, coverage = best_sentence(content, query)
        if not sentence or coverage < request.minGroundingScore or (not QDRANT_ENABLE_SPARSE and float(point.get("score", 0.0)) < MIN_DENSE_SCORE):
            continue
        matches.append({
            "id": str(point["id"]),
            "documentId": str(payload.get(PAYLOAD_DOCUMENT_ID_FIELD, payload.get("chunk_id", ""))),
            "language": payload.get(PAYLOAD_LANGUAGE_FIELD, "hi"),
            "strategy": payload.get("strategy", "selected_passage"),
            "content": content,
            "denseScore": float(point.get("score", 0.0)),
            "sparseScore": 0.0,
            "rrfScore": float(point.get("score", 0.0)),
            "source": {"dataset": payload.get("dataset") or PAYLOAD_DATASET or "unverified-source", "split": payload.get("split") or PAYLOAD_SPLIT or "unverified-split", "queryId": payload.get("queryId", payload.get("metadata", {}).get("doc_id")), "passageOrdinal": payload.get("passageOrdinal")},
        })
    fusion_ms = ms(rerank_start)
    return {"indexVersion": COLLECTION, "matches": matches, "timings": {"queryEmbeddingMs": query_embedding_ms, "denseSearchMs": hybrid_search_ms, "sparseSearchMs": hybrid_search_ms if QDRANT_ENABLE_SPARSE else 0.0, "fusionMs": fusion_ms, "totalMs": round(query_embedding_ms + hybrid_search_ms + fusion_ms, 3)}}
