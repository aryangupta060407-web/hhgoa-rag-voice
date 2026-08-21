# HH Goa Final Submission Checklists

## Video 1 — Team / Process (90 seconds)

- [ ] Record team members planning the deterministic architecture from the provided reference PDFs.
- [ ] Show the offline chunking and provenance-preserving MSMARCO-XI slice decision.
- [ ] Show the typed orchestration, deterministic guardrails, and passing test suite.
- [ ] Show the cold benchmark control; do not turn this into a polished product-only demo.
- [ ] Keep the final cut at or below 90 seconds and verify captions/text are readable.

## Video 2 — End-to-End Product Demo

- [ ] Record a short microphone question and show the separate transcript card.
- [ ] Point to Sarvam as the primary STT route and explain Whisper fallback only if it appears.
- [ ] Show the extractive evidence sentence, source chunks, scores, and query ID provenance.
- [ ] Show one unsafe or unsupported/off-topic query being refused instead of answered.
- [ ] Run the 24-query cold benchmark and show `population=cold_benchmark`, `n=24`, P50, P70, and P100.
- [ ] State clearly that no generative LLM is called anywhere in the pipeline.

## Mandatory Promotion

- [ ] Every team member uploads **both** videos to Instagram.
- [ ] Every team member uploads **both** videos to X.
- [ ] Every upload includes the exact tag `#RAGInGoa`.
- [ ] Confirm at least one team member’s Instagram account is public.
- [ ] Save links/screenshots of each post for the team’s own verification.

## Final Form Submission

- [ ] Create a fresh project checkpoint after all final edits and tests pass.
- [ ] Publish the app and open the live URL in a private/incognito browser window.
- [ ] Verify typed retrieval, a voice query, an evidence-backed answer, a refusal, history persistence, and cold-benchmark analytics in the published app.
- [ ] Add the GitHub repository URL.
- [ ] Add the live published URL.
- [ ] Add both final video links and confirm the required social posts are live.
- [ ] Re-read every field in the form before submitting; do not submit placeholder links.
