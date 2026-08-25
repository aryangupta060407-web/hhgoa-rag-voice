# Three-Language Evaluation Evidence

The final submission evidence comprises three independently completed 25-answerable plus 25-unanswerable evaluator runs. Each run was executed through the finalized target-language evaluator and captured to an exact raw terminal log with `tee`; the accompanying PNG images are direct browser screenshots of those raw log files.

| Language | Raw terminal log | Screenshot | JSON result |
|---|---|---|---|
| English | `results/20260825_english_final_raw_terminal.log` | `Samvad-English-Eval-Results-FINAL.png` | `results/20260825T060207Z.json` |
| Hindi | `results/20260825_hindi_final_raw_terminal.log` | `Samvad-Hindi-Eval-Results-FINAL.png` | `results/20260825T060313Z.json` |
| Marathi | `results/20260825_marathi_final_raw_terminal.log` | `Samvad-Marathi-Eval-Results-FINAL.png` | `results/20260825T060113Z.json` |

All runs used seed `42`, `top_k=5`, 25 answerable plus 25 unanswerable examples, the deterministic extractive-or-refuse adapter, and `--skip-judge` after the optional external judge returned no usable completion. The three rows are separate measurements and must not be averaged into a 150-example claim.
