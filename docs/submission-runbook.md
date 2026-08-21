# Verity — HH Goa Task 2 Submission Runbook

## What was built

Verity is a **voice-driven, non-generative extractive RAG system** over a provenance-preserving compact slice of the Hindi validation split of `ai4bharat/MSMARCO-XI`. A spoken question is transcribed by Sarvam with automatic Whisper fallback, sent through deterministic guardrails, retrieved from a pre-built in-memory hybrid index, and answered by returning the highest-scoring evidence sentence. The system makes **no generative LLM calls**.

| Requirement | Implementation evidence |
| --- | --- |
| Voice input and speech-to-text | Browser `MediaRecorder` captures WebM audio. The server routes to Sarvam first and retries once. If Sarvam fails, is rate-limited, or is not configured, it uploads the audio privately and invokes the built-in Whisper transcription helper. |
| Dataset use | The source is the Hindi validation shard of `ai4bharat/MSMARCO-XI`; every seeded record retains the upstream query ID, target language, translated query, selected English passage, and selected translated passage. The upstream dataset is 55.6 GB, so the deployed demo uses an honest offline-built compact validation slice rather than pretending to load the whole corpus into a 512 MB web container. [1] |
| Multi-strategy chunking | The index is built before runtime with fixed-size overlapping windows, two-sentence semantic windows, and metadata-aware chunks that include query class and language. No corpus chunking occurs during a request. |
| Fast deterministic retrieval | A compact 384-dimensional feature-hash embedding, in-memory cosine candidate scoring, lexical token matching, and Reciprocal Rank Fusion form a hybrid retriever. The final answer is a verbatim sentence selected by deterministic coverage, relevance, and phrase scoring. |
| Harness | Typed tRPC schemas validate all inputs and outputs. The transcription router has retry/fallback recovery; the RAG orchestrator records stage timings and persists a structured replay log. |
| Guardrails | The pipeline blocks unsafe intent patterns, identifies low corpus affinity / low lexical support as off-topic, and refuses when grounding confidence is below its evidence threshold. It does not fabricate an answer. |
| Analytics and history | The database stores transcript, answer mode, guardrail decision, sources, stage timings, transcription provider, and execution type. The dashboard shows P50/P70/P100 and keeps controlled cold-benchmark data separate from live queries. |

> **Latency boundary.** The measured sub-200 ms target applies to the deterministic **retrieval-to-answer** path after text is available. STT is shown and stored separately because an external audio API’s network time is inherently variable. This keeps the claim precise rather than hiding network latency.

## Measured controlled benchmark

The project’s cold benchmark resets the semantic cache before every test query and runs 24 real English/Hindi questions derived from the included MSMARCO-XI records. The benchmark was run in the managed development environment with the pre-built in-memory demo index.

| Population | Metric | P50 | P70 | P100 | SLA interpretation |
| --- | --- | ---: | ---: | ---: | --- |
| 24 cold benchmark queries | Retrieval-to-answer | **0.7 ms** | **0.7 ms** | **3.9 ms** | Meets the 200 ms retrieval-to-answer target in this demonstrated corpus/index configuration. |
| 24 cold benchmark queries | Total server RAG request | **0.7 ms** | **0.7 ms** | **3.9 ms** | Same measurement because the benchmark executes text retrieval, not external STT. |
| Recorded voice queries | Transcription | Measured separately in the UI | Measured separately in the UI | Measured separately in the UI | Not included in the deterministic retrieval SLA. |

The initial cold run includes small runtime warm-up overhead, which explains why the maximum is larger than the median. The interface intentionally displays the maximum rather than only an average.

## Live demo sequence

Start with a short typed query such as **“How fast does an eagle travel?”**. The response should quote the evidence sentence, show the three retrieved chunks with scores, show `passed` guardrail status, and expose the stage breakdown. Then ask an unrelated question such as **“Which moon of Neptune has a purple ocean?”** to demonstrate a grounded refusal. Finally, record a short voice question to show the Sarvam route and, if needed, the automatic Whisper fallback.

Open the latency panel and click **Run 24-query cold benchmark**. Wait for the `population=cold_benchmark` label and `n=24`; this is the screenshot to use for latency evidence. The query-history panel will show replayable records persisted during the run.

Complete the concrete recording, posting, and form-submission checks in [submission-checklists.md](./submission-checklists.md) before opening the final form. The task does not allow resubmission, so no placeholder links or unchecked promotion requirements should remain.

## Deployment and submission steps

Create a GitHub repository from the project’s management interface and copy its URL into the HH Goa form. Create a checkpoint, then use the **Publish** button in the project interface to obtain the live working link. After publishing, run the cold benchmark once in the deployed build and record the displayed P50/P70/P100 values in the form or demo video; deployment hardware can change observed results.

| Submission asset | Suggested content |
| --- | --- |
| Repository link | Include this project, `docs/reference-methods.md`, `docs/dataset-scope.md`, and this runbook. Do not include the downloaded 441 MB Parquet shard. |
| Live link | Open the published app, show one typed evidence-backed answer, one refusal, and one voice interaction. |
| Video 1 — 90-second process | Show the team reviewing the supplied low-latency references, the offline index build script, the typed harness/guardrails tests, and the controlled benchmark. Avoid presenting a polished product tour in this process video. |
| Video 2 — demo | Record the sequence above: voice capture → transcript → sources/scores → extractive answer → guardrail refusal → `n=24` analytics. State explicitly that no generative LLM is used. |
| Promotion posts | Each team member must upload both videos to Instagram and X with `#RAGInGoa`. Confirm that at least one Instagram account is public before submitting. |

## Scale-up path

The demonstration is intentionally designed around the principles in the user-supplied low-latency references: offline chunking, hybrid retrieval, Reciprocal Rank Fusion, semantic cache separation, and extractive evidence selection. At full 55.6 GB scale, replace the compact in-memory candidate scorer with a pre-built HNSW or IVF-PQ index and replace the deterministic feature hash with a quantized ONNX sentence encoder. Those are offline/runtime infrastructure upgrades; they do not require reintroducing a generative model.

## References

[1] [AI4Bharat, *MSMARCO-XI Dataset*](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)

[2] [Sarvam, *Speech-to-Text REST API*](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe)
