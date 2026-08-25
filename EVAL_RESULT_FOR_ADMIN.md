# संवाद (Samvad) — Multilingual Evaluation Result

## What the Previous Report Covered

The earlier evaluation was **not Marathi**. It used the supplied evaluator’s default `--language hin`, which loads the official Hindi validation split. That run used **English plus Hindi** query/evidence variants only.

The official MSMARCO-XI dataset also provides a Marathi validation file, `marval`, with translated query, answer, and selected-passage ground truth.[1] The evaluator was therefore generalized to load the requested official Indic-language split rather than assuming Hindi aliases.

## Real Evaluation Runs

| Run | Official source | Languages represented in the temporary evaluator index | Sample | R@1 | R@3 | R@5 | MRR | False refusal | False confidence | Retrieval P95 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hindi | `validation/hinval.parquet` | English + Hindi | 25 answerable + 25 unanswerable | 0.560 | 0.800 | 0.840 | 0.6833 | 0.240 | 0.320 | 20.04 ms |
| Marathi | `validation/marval.parquet` | English + Marathi | 25 answerable + 25 unanswerable | 0.480 | 0.760 | 0.920 | 0.6580 | 0.120 | 0.680 | 25.34 ms |

Both measurements use the project's real `intfloat/multilingual-e5-small` embedder and its deterministic extractive-or-refuse adapter. The isolated FAISS index is constructed by the evaluation loop from the sampled official candidate passages. These are **not** production Qdrant/RRF metrics.

> **Important:** English is included as the original-content retrieval arm in both evaluations. It is not an independently scored English-only run. Do not merge or average the Hindi and Marathi scores into a single combined score.

## Judge Status

Faithfulness and correctness are **SKIPPED** in both reports. The configured optional external judge returned no usable completion in the earlier attempt, so it was intentionally disabled for the local-metrics reruns. No judge score was inserted manually. The judge is not part of Samvad’s answer path.

## Files to Submit

Use the terminal-format text and matching JSON for each language:

| Language | Terminal-style report | Machine-readable evidence |
|---|---|---|
| Hindi | `results/20260822T181145Z_admin_output.txt` | `results/20260822T181145Z.json` |
| Marathi | `results/20260825T053429Z_admin_output.txt` | `results/20260825T053429Z.json` |

## References

[1]: https://huggingface.co/datasets/ai4bharat/MSMARCO-XI "AI4Bharat MSMARCO-XI dataset card"
