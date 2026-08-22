# Run This First

The administrator wants the **evaluation output**, like the example pasted by other teams. The simplest way is to run one file.

1. Extract the source ZIP to a normal folder, for example `C:\HHGoaVoiceRAG`.
2. Open that folder in File Explorer.
3. Right-click an empty area and choose **Open in Terminal**.
4. Paste this command and press Enter:

```powershell
powershell -ExecutionPolicy Bypass -File .\RUN_EVAL_FOR_ADMIN.ps1
```

The first run downloads Python packages, the multilingual embedding model, and a small MSMARCO-XI evaluation sample. It can take several minutes. Do not close the window.

When it finishes, send the administrator:

1. a screenshot or copied text of the full terminal result, and
2. the newest JSON file inside the `results` folder.

## Important

The evaluator’s **faithfulness** and **correctness** sections require an `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` owned by the person running the evaluation. Do not paste any key into chat, source code, or the ZIP.

- If that key is available, those sections run and the report looks like the peer example.
- If no key is available, the evaluator still reports real retrieval, reliability, and latency numbers, while the judge-based sections honestly show `SKIPPED`.

The application itself remains non-generative. A judge credential is used only by the external evaluator to grade the output; it is never used to answer user questions.
