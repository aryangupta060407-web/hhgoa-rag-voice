"""Render a truthful combined English/Hindi/Marathi evaluator summary from real JSON results.

The output deliberately presents three separate runs and never computes an aggregate score.
"""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path


SOURCE = {
    "eng": "Official original English fields in hinval",
    "hin": "Official Hindi hinval translation",
    "mar": "Official Marathi marval translation",
}
DISPLAY = {"eng": "English", "hin": "Hindi", "mar": "Marathi"}


def load_result(path_text: str, expected_language: str) -> tuple[Path, dict]:
    path = Path(path_text).resolve()
    payload = json.loads(path.read_text(encoding="utf-8"))
    actual = payload.get("meta", {}).get("language")
    if actual != expected_language:
        raise ValueError(f"{path.name} is language={actual!r}, expected {expected_language!r}")
    return path, payload


def metric(payload: dict, key: str) -> float:
    return float(payload["retrieval"]["cross_lingual"]["recall_at_k"][key])


def card(language: str, path: Path, payload: dict) -> str:
    reliability = payload["reliability"]
    p95 = float(payload["latency"]["retrieval_total"]["p95_ms"])
    rows = [
        ("Recall@1", f"{metric(payload, '1'):.3f}", ""),
        ("Recall@3", f"{metric(payload, '3'):.3f}", ""),
        ("Recall@5", f"{metric(payload, '5'):.3f}", ""),
        ("MRR", f"{float(payload['retrieval']['cross_lingual']['mrr']):.3f}", ""),
        ("False refusal", f"{float(reliability['false_refusal_rate']):.3f}", "bad" if reliability["false_refusal_rate"] else "good"),
        ("False confidence", f"{float(reliability['false_confidence_rate']):.3f}", "bad" if reliability["false_confidence_rate"] else "good"),
        ("Retrieval P95", f"{p95:.2f} ms", "good" if payload["latency"]["retrieval_within_budget"] else "bad"),
    ]
    rendered_rows = "".join(
        f'<div class="row"><span class="label">{label}</span><strong class="{state}">{value}</strong></div>'
        for label, value, state in rows
    )
    return f'''<article class="card"><div class="lang"><h2>{DISPLAY[language]}</h2><span class="source">{SOURCE[language]}</span></div>{rendered_rows}<div class="file">{html.escape(path.name)}</div></article>'''


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--english", required=True)
    parser.add_argument("--hindi", required=True)
    parser.add_argument("--marathi", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    results = [
        ("eng", *load_result(args.english, "eng")),
        ("hin", *load_result(args.hindi, "hin")),
        ("mar", *load_result(args.marathi, "mar")),
    ]
    meta = results[0][2]["meta"]
    sample = f"{meta['num_answerable']} answerable + {meta['num_unanswerable']} unanswerable"
    budget = results[0][2]["latency"]["retrieval_latency_budget_ms"]
    judge_note = results[0][2].get("faithfulness", {}).get("error", "Judge metrics were not available.")
    cards = "\n".join(card(lang, path, payload) for lang, path, payload in results)

    document = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Samvad — Three-Language Evaluation</title><style>
    :root{{--ink:#07130e;--panel:#0e2218;--line:#2d6249;--lime:#d7ed73;--paper:#eff7e8;--muted:#b4c8ba;--pink:#ef79b1;--warn:#ffcf72}}*{{box-sizing:border-box}}body{{margin:0;padding:44px;background:var(--ink);color:var(--paper);font-family:Arial,Helvetica,sans-serif}}.page{{width:1512px;margin:0 auto;border:1px solid var(--line);border-radius:20px;overflow:hidden;background:linear-gradient(145deg,#102b1d,#08180f 70%)}}header{{padding:38px 48px 29px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-start}}.eyebrow{{color:var(--lime);letter-spacing:3px;font:700 15px "Courier New",monospace}}h1{{font-family:Georgia,serif;font-size:43px;margin:11px 0 8px;line-height:1}}.sub{{max-width:850px;color:var(--muted);margin:0;font-size:18px;line-height:1.45}}.badge{{border:1px solid var(--lime);border-radius:999px;color:var(--lime);padding:12px 16px;font:700 14px "Courier New",monospace;white-space:nowrap}}main{{padding:34px 48px 44px}}.rule{{margin:0 0 25px;border-left:4px solid var(--warn);padding:11px 15px;color:#f7e4ad;background:rgba(255,207,114,.09);font-size:18px;line-height:1.45}}.cards{{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}}.card{{border:1px solid var(--line);border-radius:14px;padding:24px 25px 22px;background:rgba(3,16,9,.44)}}.lang{{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(180,200,186,.24);padding-bottom:15px}}h2{{margin:0;font-family:Georgia,serif;font-size:29px}}.source{{color:var(--muted);font-size:13px;line-height:1.35;text-align:right;max-width:172px}}.row{{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dotted rgba(180,200,186,.22);font-size:16px}}.row strong{{font-family:"Courier New",monospace;color:#fff;font-size:18px}}.label{{color:var(--muted)}}.good{{color:var(--lime)!important}}.bad{{color:var(--pink)!important}}.file{{padding-top:14px;color:#91a99a;font:12px "Courier New",monospace;overflow-wrap:anywhere}}.footgrid{{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin-top:24px}}.foot{{border:1px solid var(--line);border-radius:14px;padding:22px 25px;background:rgba(3,16,9,.34)}}.foot h3{{margin:0 0 11px;color:var(--lime);font:700 16px "Courier New",monospace;letter-spacing:1px}}.foot p{{color:var(--muted);margin:0;font-size:16px;line-height:1.47}}.status{{color:#eab6d5!important}}footer{{padding:17px 48px;border-top:1px solid var(--line);color:#91a99a;font:14px "Courier New",monospace}}</style></head><body><section class="page"><header><div><div class="eyebrow">संवाद · SAMVAD · HH GOA TASK 02</div><h1>Combined Three-Language Evaluation</h1><p class="sub">A single submission view of the finalized <strong>separate</strong> English, Hindi, and Marathi evaluations.</p></div><div class="badge">NO GENERATIVE ANSWER MODEL</div></header><main><div class="rule"><strong>Scope:</strong> Each column is one independent, real {sample} run (seed {meta['seed']}, top_k={meta['top_k']}). This image does <strong>not</strong> claim an averaged or fabricated 150-example aggregate score.</div><div class="cards">{cards}</div><div class="footgrid"><section class="foot"><h3>COMMON PROTOCOL</h3><p>MSMARCO-XI official query / answer / selected-passage mappings · isolated FAISS index built from sampled candidates · real multilingual E5 embeddings · deterministic extractive answer-or-refusal adapter.</p></section><section class="foot"><h3>JUDGE STATUS</h3><p class="status">Faithfulness and correctness: <strong>SKIPPED</strong>. {html.escape(judge_note)}</p></section></div></main><footer>All retrieval P95 values are checked against the {budget} ms budget. The three metrics are displayed separately and are never averaged.</footer></section></body></html>'''
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
