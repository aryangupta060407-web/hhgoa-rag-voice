# HH Goa Task 2 — Evaluation-Loop Submission Note

**Project:** संवाद (Samvad)  
**Answer path:** Deterministic, extractive, and non-generative  
**Evaluation package:** `rag-local-eval-loop` supplied in the evaluation runbook

## What Has Been Added

The repository now includes the evaluator source under `eval/`, its Windows and Unix launchers (`run.ps1`, `run.sh`), and a project-native Python adapter under `app/`.

| Evaluation-loop requirement | Added project artifact | Status |
|---|---|---|
| Real encoder callable through `embed()` / `embed_one()` | `app/embedder.py` | Contract verified |
| Real answer/refusal callable through `generate_answer()` | `app/generator.py` | Contract verified |
| Optional evaluator metadata | `app/config.py` | Present |
| Supplied evaluator and launchers | `eval/`, `run.ps1`, `run.sh` | Present |
| Administrator run instructions | `docs/eval-loop-administrator-guide.md` | Present |
| Evaluator dependency list | `eval-requirements.txt` | Present |

The adapter uses the production dense encoder, `intfloat/multilingual-e5-small`, with raw text and no query/passage prefix. Its answer function is deterministic: it extracts a sentence only when lexical coverage and a subject anchor are present in evaluator-provided context; otherwise it emits an explicit refusal. It does not call an LLM, translate text, or fabricate an answer.

## Verification Completed

The supplied evaluator successfully resolved this project’s adapter modules and their required function names using its native `eval.target.verify_target()` contract check. Focused regression checks cover both supported extraction and refusals when a sentence only overlaps weakly with a multi-part question.

The project now has **two separate real 25-answerable plus 25-unanswerable runs**. MSMARCO-XI publishes distinct Hindi (`hinval`) and Marathi (`marval`) validation files, each with translated queries, answers, selected-passage labels, and original English content.[1]

| Evaluated validation file | Query/evidence languages in the temporary FAISS index | Result JSON | Retrieval metrics | Reliability | Retrieval P95 |
|---|---|---|---|---|---:|
| Hindi `hinval` | English + Hindi | `results/20260822T181145Z.json` | R@1 0.560; R@3 0.800; R@5 0.840; MRR 0.6833 | False refusal 0.240; false confidence 0.320 | 20.04 ms |
| Marathi `marval` | English + Marathi | `results/20260825T053429Z.json` | R@1 0.480; R@3 0.760; R@5 0.920; MRR 0.6580 | False refusal 0.120; false confidence 0.680 | 25.34 ms |

The original submitted result was Hindi-scoped because it ran the evaluator default `--language hin`; that is now corrected with a separately labeled Marathi run. **English is the paired original-content arm in both runs, not a separately measured English-only score.** The two reports must not be averaged or presented as one combined 100-example result.

Judge-backed faithfulness and correctness are intentionally marked **SKIPPED** for this run. The configured external judge returned no usable completion in the earlier attempt, so the rerun used `--skip-judge` rather than pretending a judge score existed. The optional judge is only a grader; it is never used in the application's deterministic answer path.

## Administrator Run Command

On Windows PowerShell, from the project root:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\pip install -r .\eval-requirements.txt
.\run.ps1 --num-answerable 3 --num-unanswerable 3 --workers 1
```

After the smoke test completes, run:

```powershell
.\run.ps1 --num-answerable 50 --num-unanswerable 50 --workers 1
```

If no usable judge service is available, use the following honest local-metrics run:

```powershell
.\run.ps1 --num-answerable 25 --num-unanswerable 25 --workers 1 --skip-judge
```

Submit the untouched terminal output and `results/<timestamp>.json`. The report’s retrieval numbers evaluate the project’s real E5 encoder on the evaluator’s own temporary FAISS index; they should not be represented as production Qdrant hybrid/RRF scores. The project-native live Qdrant diagnostic report is supplementary evidence only.

To reproduce the Marathi run, use:

```powershell
.\run.ps1 --num-answerable 25 --num-unanswerable 25 --workers 1 --language mar --skip-judge
```

## References

[1]: https://huggingface.co/datasets/ai4bharat/MSMARCO-XI "AI4Bharat MSMARCO-XI dataset card"
