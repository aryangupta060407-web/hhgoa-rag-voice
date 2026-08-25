# संवाद (Samvad) — Three-Language Evaluation Result

## Evaluation Protocol

This submission contains **three separate real evaluation runs**, one each for **English**, **Hindi**, and **Marathi**. Every run used the same fixed sample size: **25 answerable plus 25 unanswerable examples**, seed `42`, `top_k=5`, the project’s real `intfloat/multilingual-e5-small` embedder, and the deterministic extractive-or-refuse adapter.

The official MSMARCO-XI dataset publishes English originals alongside each Indic translation and includes translated queries, answers, and selected-passage labels for Hindi and Marathi.[1] The English-only run reads the official original English columns from `hinval`; it does not use a machine translation.

> **Important:** Each row is a separate 50-example evaluation. Do not add, average, or relabel the scores as one 150-example run.

## Real Results

| Evaluated language | Official source | Result JSON | Recall@1 | Recall@3 | Recall@5 | MRR | False refusal | False confidence | Retrieval P95 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| English | Original English fields in `validation/hinval.parquet` | `results/20260825T060207Z.json` | 0.440 | 0.760 | 0.840 | 0.620 | 0.240 | 0.320 | 21.50 ms |
| Hindi | `validation/hinval.parquet` | `results/20260825T060313Z.json` | 0.560 | 0.800 | 0.840 | 0.683 | 0.000 | 0.920 | 21.48 ms |
| Marathi | `validation/marval.parquet` | `results/20260825T060113Z.json` | 0.480 | 0.760 | 0.920 | 0.658 | 0.120 | 0.680 | 20.16 ms |

All three **retrieval P95** measurements are below the application’s declared **200 ms** retrieval budget. The low reliability values are included exactly as measured; no metric was improved or substituted for submission.

## Judge Status

Faithfulness and correctness are marked **SKIPPED** in all three reports. The optional external judge returned no usable completion in the earlier attempt, so it was intentionally disabled with `--skip-judge` for reproducible local metric runs. No external judge metric was fabricated. The judge is never part of Samvad’s answer path.

## What to Submit

Submit the following three screenshots if the form accepts multiple files, plus the matching JSON files if requested.

| Language | Direct evaluator-output screenshot | Matching terminal text | Matching JSON |
|---|---|---|---|
| English | `Samvad-English-Eval-Results-FINAL.png` | `results/20260825_english_final_raw_terminal.log` | `results/20260825T060207Z.json` |
| Hindi | `Samvad-Hindi-Eval-Results-FINAL.png` | `results/20260825_hindi_final_raw_terminal.log` | `results/20260825T060313Z.json` |
| Marathi | `Samvad-Marathi-Eval-Results-FINAL.png` | `results/20260825_marathi_final_raw_terminal.log` | `results/20260825T060113Z.json` |

## References

[1]: https://huggingface.co/datasets/ai4bharat/MSMARCO-XI "AI4Bharat MSMARCO-XI dataset card"
