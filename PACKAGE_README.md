# HH Goa Voice RAG — Portable Project Package

This archive contains the current source code, deterministic multilingual RAG implementation, diagnostic scripts and outputs, test suite, Docker deployment assets, and Vercel/EC2 deployment documentation.

## Included

| Area | Contents |
|---|---|
| Application | React/Vite client, Express/tRPC server, deterministic RAG pipeline, voice transcription integration, and benchmark UI |
| Retrieval | Qdrant gateway, JSONL indexer, hybrid dense-plus-BM25/RRF configuration, and deployment Compose file |
| Diagnostics | Compact and live-gateway multilingual coverage harnesses, JSON traces, and audit reports |
| Deployment | Vercel frontend and EC2 backend runbook, environment-variable requirements, and Docker assets |
| Tests | Vitest deterministic RAG, gateway contract, benchmark, router, and transcription tests |

## Local requirements

Use Ubuntu 24.04 or a comparable Linux environment with Node.js 22, pnpm, Python 3.11, Docker/Docker Compose for the retrieval backend, and sufficient RAM for Qdrant plus SentenceTransformers. The recommended first full-corpus backend is an EC2 `r7i.xlarge` with 32 GiB RAM and a 100 GiB gp3 volume.

Install application dependencies with:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit
```

## Required deployment variables

The frontend requires `VITE_API_BASE_URL=https://api.<your-domain>`. The EC2 Node API requires `CORPUS_RETRIEVAL_URL`, `CORPUS_RETRIEVAL_TOKEN`, `CORS_ALLOWED_ORIGINS`, and `SARVAM_API_KEY` when voice transcription is enabled. The EC2-only gateway requires `GATEWAY_TOKEN`, `QDRANT_COLLECTION`, `DENSE_MODEL=intfloat/multilingual-e5-small`, `EMBEDDING_BACKEND=sentence-transformers`, and the vector/payload settings documented in `docs/vercel-ec2-deployment-runbook.md`.

## Excluded intentionally

The ZIP excludes `node_modules`, build output, `.git`, `.env` files, local Qdrant storage, downloaded corpus files, screenshots, and runtime logs. These can contain secrets, are machine-specific, or are too large for a portable source package. The archive includes reproducible index and deployment instructions but not the 8,311-passage Qdrant data itself.

## Deployment

Follow `docs/vercel-ec2-deployment-runbook.md`. Keep Qdrant on a private Docker network, bind the gateway to EC2 loopback only, expose only the Node API through HTTPS, and never place retrieval tokens or Qdrant credentials in Vercel frontend variables.
