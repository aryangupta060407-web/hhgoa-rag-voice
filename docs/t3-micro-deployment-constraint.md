# t3.micro Deployment Constraint

## Decision

Do not deploy the full deterministic multilingual retrieval backend to a free-tier `t3.micro`. It has 1 GiB of RAM, which is insufficient for Qdrant, the SentenceTransformers `intfloat/multilingual-e5-small` model, FastEmbed BM25, the Python gateway, and the Node API running together. The local diagnostics already demonstrated that constrained-memory indexing and gateway work can fail under pressure.

## Safe role split

| Host | Safe role | Do not run there |
|---|---|---|
| Vercel | React/Vite static frontend | Qdrant, retrieval gateway, service tokens |
| Free-tier `t3.micro` | Optional lightweight Node API proxy or project landing page | Qdrant plus multilingual E5 gateway; full index build |
| 16–32 GiB persistent machine | Qdrant, BM25, multilingual E5 gateway, and Node API | Nothing browser-facing except HTTPS Node API |

## Practical choices

For a free demo, keep the Vercel frontend and compact validation corpus. For a full 8,311-passage deterministic deployment, use an available Oracle Always Free Arm VM with sufficient allocated memory, or a paid EC2 memory-optimized instance in Mumbai. Keep Qdrant and the gateway private; only the Node/tRPC API should be public through HTTPS.
