# Compact Fallback Coverage Audit

## Scope

This audit applies only to the **Manus-published compact fallback**, not the separately deployed 8,311-passage EC2/Qdrant gateway.

| Component | Verified count | Provenance |
|---|---:|---|
| Original curated records | 8 | Existing deterministic regression corpus |
| Query-mapped English/Hindi records | 24 | `ai4bharat/MSMARCO-XI` `hinval.parquet`; original query, answer, selected passage |
| Supplemental Hindi/English/Marathi passages | 120 | User-provided processed corpus JSONL; 40 evenly sampled passages per language |
| Total compact source records/passages | 152 | Displayed by the Manus-publish fallback |

## Measured Result

`scripts/audit_compact_validation.ts` ran the 24 source-mapped validation records using both their original English and Hindi queries.

| Metric | Result |
|---|---:|
| Real query-mapped documents | 24 |
| English/Hindi answerable cases | 48 |
| Extractive passes | 48 / 48 (100%) |
| Refusals within answerable audit | 0 |
| P95 retrieval-to-answer latency | 4.364 ms |

The existing 12-case safety benchmark also passed 12 / 12 after corpus expansion. It covers factual, adversarial, unsupported, and personal-refusal behavior, including the Marathi personal-query refusal.

## Marathi Limitation

The local source set includes Marathi passages (`mr_corpus.jsonl`) but **does not include a Marathi validation file with original question-answer-selected-passage mappings** equivalent to `hinval.parquet`. Therefore the project does not claim a verified Marathi answerable-query pass rate for the compact fallback. It does retain Marathi passages for retrieval and validates the Marathi personal-question refusal, but further source-mapped Marathi answer coverage requires a verifiable Marathi query mapping.

## Safety Rule

Expansion does not permit generic token matches to masquerade as evidence. The compact pipeline now requires a non-generic subject anchor in the selected passage. This blocks unrelated answers driven by words such as *fast*, *make*, or Hindi location predicates while preserving grounded extractive answers.
