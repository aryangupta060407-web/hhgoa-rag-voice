# Project TODO

- [x] Add typed domain schemas for voice queries, orchestration outcomes, retrieved passages, guardrail decisions, and per-stage latency measurements.
- [x] Implement a deterministic, offline-built multi-strategy MSMARCO-XI demo index with fixed-overlap, semantic, and metadata-aware chunks.
- [x] Implement server-side lightweight embedding, in-memory cosine retrieval, extractive answer selection, and deterministic guardrails with no generative LLM calls.
- [x] Add retry-aware speech-to-text provider routing, including a primary Sarvam or ElevenLabs adapter and an automatic Whisper fallback adapter.
- [x] Add database schema and tRPC procedures for persisted query history and latency analytics.
- [x] Build a polished voice recording interface with transcript, answer, sources, guardrail status, stage timings, and responsive error states.
- [x] Build query-history and latency-analytics views with P50, P70, and P100 aggregations.
- [x] Add deterministic test fixtures and Vitest coverage for orchestration, guardrails, extraction, and latency aggregation.
- [x] Run test, type-check, and visual verification; document measured retrieval-to-answer latency and known limitations for submission.
- [x] Prepare a concise runbook, demo script, video checklist, and final submission checklist.
- [x] Review the two user-provided low-latency non-LLM RAG references and incorporate their applicable methods into the architecture and project documentation.
- [x] Add a dedicated voice transcript card in the result area so recorded speech is visible separately from the editable query field.
- [x] Create explicit video-production and final-submission checklists and link them from the runbook.
