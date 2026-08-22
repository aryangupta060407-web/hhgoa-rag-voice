# HH Goa Task 2 — Evaluation-Loop Submission Note

**Project:** HH Goa Voice RAG  
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

The supplied evaluator successfully resolved this project’s adapter modules and their required function names using its native `eval.target.verify_target()` contract check. Lightweight regression checks also verified both a supported extractive response and an unrelated-evidence refusal.

> A full score report is intentionally **not claimed yet**. The administrator must run the evaluator against the submitted source to produce the required timestamped JSON report. Judge-backed faithfulness and correctness require an administrator-provided OpenAI or Anthropic judge credential. That credential is separate from the application answer path and must not be included in the source package.

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

Submit the untouched terminal output and `results/<timestamp>.json`. The report’s retrieval numbers evaluate the project’s real E5 encoder on the evaluator’s own temporary FAISS index; they should not be represented as production Qdrant hybrid/RRF scores. The project-native live Qdrant diagnostic report is supplementary evidence only.
