# Combined English, Hindi, and Marathi Evaluation Code

Run the following command from the project folder in **Windows PowerShell**:

```powershell
powershell -ExecutionPolicy Bypass -File ".\RUN_3_LANGUAGE_EVAL_FOR_ADMIN.ps1"
```

This code runs the same real evaluator three times, sequentially:

| Run | Command used internally | Official fields used |
|---|---|---|
| English | `python -m eval.runner --language eng --skip-judge` | Original English query, answer, and passage fields in `hinval` |
| Hindi | `python -m eval.runner --language hin --skip-judge` | Hindi translation fields in `hinval` |
| Marathi | `python -m eval.runner --language mar --skip-judge` | Marathi translation fields in `marval` |

Every language uses **25 answerable + 25 unanswerable examples**, `seed=42`, `top_k=5`, the real multilingual E5 embedder, and the deterministic extractive-or-refuse answer adapter.

> The output is **three separate real runs**, not an average. Do not write an invented combined score.

The runner saves each language’s exact terminal output as a `*_raw_terminal.log` file and produces a matching JSON metrics file in `results/`.

## Generate one combined screenshot from the three real JSON outputs

After the three runs finish, copy the newest English, Hindi, and Marathi JSON filenames from `results/`, then run:

```powershell
powershell -ExecutionPolicy Bypass -File ".\RENDER_COMBINED_3_LANGUAGE_SUMMARY.ps1" `
  -EnglishJson ".\results\YOUR_ENGLISH_RESULT.json" `
  -HindiJson ".\results\YOUR_HINDI_RESULT.json" `
  -MarathiJson ".\results\YOUR_MARATHI_RESULT.json"
```

This calls `scripts/render_combined_eval_summary.py`, which reads the three real JSON files and writes `results\combined-three-language-eval.html`. The script then asks local Chrome to create `results\Samvad-Combined-Three-Language-Eval.png`.

The generator displays the three language metrics side by side and explicitly says they are separate runs. It **does not calculate an overall average or combine them into an invented score**.
