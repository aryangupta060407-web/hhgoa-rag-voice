# Administrator Evaluation-Loop Guide

## Purpose and Scope

This project includes a native adapter for the supplied `rag-local-eval-loop`. The adapter exposes the **same `intfloat/multilingual-e5-small` dense encoder** used by the deployed deterministic retrieval gateway and reproduces the project’s extractive-only answer/refusal policy. It contains **no generative answer model**.

The supplied evaluator deliberately builds its own temporary FAISS index from sampled MSMARCO-XI validation candidates. Its retrieval scores therefore measure the project’s real embedding model on the evaluator’s isolated index; they do **not** measure the production Qdrant hybrid/RRF, language-filter, or candidate-reranking pipeline. This distinction should be retained when interpreting the report.

## Adapter Contract

| Evaluator requirement | Project implementation |
|---|---|
| `app.embedder.get_model()` | Loads `intfloat/multilingual-e5-small` once. |
| `app.embedder.embed()` / `embed_one()` | Returns real normalized multilingual E5 vectors. |
| `app.generator.generate_answer()` | Selects a verbatim sentence only after lexical coverage and subject-anchor checks; otherwise returns a deterministic refusal. |
| `app.config.LATENCY_BUDGET_MS` | Declares a 200 ms evaluator retrieval budget. |

## Required Evaluation Setup

The evaluator requires Python 3.10+ and an environment containing the evaluator dependencies plus `sentence-transformers`. It also downloads the sampled MSMARCO-XI validation data and the E5 model if they are not already cached.

Copy the evaluator’s `eval/` folder and `run.sh` / `run.ps1` launchers to this project root, or retain the evaluator repository separately and pass `--rag-root` to this repository’s absolute path. The project’s Python adapter is then discovered by the evaluator using its default module names.

> The deployment’s Node API, Qdrant collection, gateway token, Sarvam key, and PEM key are **not** required by this in-process evaluator and must never be copied into the evaluation directory.

### Linux/macOS Example

```bash
cd /path/to/hhgoa-rag-voice
python3 -m venv .venv
. .venv/bin/activate
pip install -r /path/to/rag-local-eval-loop/requirements.txt
cp -r /path/to/rag-local-eval-loop/eval .
cp /path/to/rag-local-eval-loop/run.sh .
chmod +x run.sh
./run.sh --num-answerable 3 --num-unanswerable 3 --workers 1
```

### Windows PowerShell Example

```powershell
cd C:\path\to\hhgoa-rag-voice
py -3.11 -m venv .venv
.\.venv\Scripts\pip install -r C:\path\to\rag-local-eval-loop\requirements.txt
Copy-Item C:\path\to\rag-local-eval-loop\eval .\eval -Recurse
Copy-Item C:\path\to\rag-local-eval-loop\run.ps1 .\run.ps1
.\run.ps1 --num-answerable 3 --num-unanswerable 3 --workers 1
```

## Full Run and Honest Interpretation

After a clean smoke test, run:

```bash
./run.sh --num-answerable 50 --num-unanswerable 50 --workers 1
```

The report writes a timestamped JSON artifact under `results/`. Submit that unedited JSON together with the terminal output. Do not substitute project-native dashboard values for evaluator numbers.

The evaluator’s **faithfulness** and **correctness** checks require a separate `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for its external judge. This key is used only by the evaluator; it is not part of the application answer path. Without it, retrieval, reliability, and latency still run, while the judge-based checks are reported as `SKIPPED`. Do not place the judge key in source control or share it in chat.

## Existing Project Evidence

The deployed application additionally has a separate project-native 54-query diagnostic audit against the actual 8,311-passage Qdrant hybrid collection. That report should be presented as **supplementary production-path evidence**, not as a replacement for the required evaluation-loop report.
