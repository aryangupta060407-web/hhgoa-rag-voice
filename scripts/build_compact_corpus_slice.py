"""Build a lightweight, source-backed fallback corpus for Manus-only demos.

The script streams user-provided hi/en/mr JSONL passages twice: first to count
selected source passages and then to choose evenly distributed records. It
never synthesizes text; every emitted value is a verbatim source passage.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def selected_rows(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            if int(row.get("is_selected", 0)) == 1 and str(row.get("text", "")).strip():
                yield row


def evenly_sample(path: Path, count: int):
    total = sum(1 for _ in selected_rows(path))
    if not total:
        return []
    take = min(total, count)
    positions = {round(index * (total - 1) / max(1, take - 1)) for index in range(take)}
    return [row for index, row in enumerate(selected_rows(path)) if index in positions]


def js(value):
    return json.dumps(value, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default="/home/ubuntu/multilingual-corpus")
    parser.add_argument("--per-language", type=int, default=40)
    parser.add_argument("--output", default="server/rag/compactCorpus.generated.ts")
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    records = []
    for language in ("hi", "en", "mr"):
        records.extend((language, row) for row in evenly_sample(source_dir / f"{language}_corpus.jsonl", args.per_language))

    lines = [
        'import type { SupplementalSourcePassage } from "./types";',
        "",
        "/**",
        " * Generated from the user-provided MSMARCO-XI processed corpus using",
        " * scripts/build_compact_corpus_slice.py. Every text value below is a",
        " * verbatim source passage; this module contains no generated answers.",
        " */",
        "export const EXPANDED_COMPACT_SOURCE_PASSAGES: SupplementalSourcePassage[] = [",
    ]
    for index, (language, row) in enumerate(records):
        text = " ".join(str(row.get("text", "")).split())
        query_ids = row.get("source_query_ids") or []
        source_id = query_ids[0] if query_ids and str(query_ids[0]).isdigit() else 9_000_000 + index
        passage_id = str(row.get("passage_id", f"{language}_p_{index:06d}"))
        lines.extend([
            "  {",
            f"    sourceQueryId: {int(source_id)},",
            f"    passageId: {js(passage_id)},",
            f"    language: {js(language)},",
            f"    content: {js(text)},",
            "  },",
        ])
    lines.extend([
        "];",
    ])
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "records": len(records), "perLanguage": args.per_language}, ensure_ascii=False))


if __name__ == "__main__":
    main()
