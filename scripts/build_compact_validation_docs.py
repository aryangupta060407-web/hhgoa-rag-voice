"""Generate a real query-mapped compact validation slice without loading parquet into memory.

Only records with an upstream selected passage are emitted. English/Hindi
queries, answers, and passages are copied verbatim from the downloaded
MSMARCO-XI validation parquet; no query or answer is synthesized.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pyarrow.parquet as pq


def compact(value):
    return " ".join(str(value or "").split())


def js(value):
    return json.dumps(value, ensure_ascii=False)


def selected_passages(row):
    passages = row.get("passages") or {}
    selected = passages.get("is_selected") or []
    try:
        index = next(index for index, value in enumerate(selected) if int(value) == 1)
    except StopIteration:
        return None
    english = (passages.get("English_passages") or [])
    translated = (passages.get("Translated_passages") or [])
    if index >= len(english) or index >= len(translated):
        return None
    return compact(english[index]), compact(translated[index])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="/home/ubuntu/msmarco-xi-data/hinval.parquet")
    parser.add_argument("--records", type=int, default=40)
    parser.add_argument("--output", default="server/rag/compactValidation.generated.ts")
    args = parser.parse_args()

    parquet = pq.ParquetFile(args.source)
    total_rows = parquet.metadata.num_rows
    targets = {round(index * (total_rows - 1) / max(1, args.records - 1)) for index in range(args.records)}
    columns = ["query_id", "query_type", "Eng_Query", "Eng_Answer", "query", "Answer", "passages"]
    records = []
    row_offset = 0
    for batch in parquet.iter_batches(batch_size=96, columns=columns):
        rows = batch.to_pylist()
        for offset, row in enumerate(rows):
            if row_offset + offset not in targets:
                continue
            matched = selected_passages(row)
            if not matched:
                continue
            english_passage, translated_passage = matched
            if not all([english_passage, translated_passage, compact(row.get("Eng_Query")), compact(row.get("query"))]):
                continue
            query_type = "NUMERIC" if str(row.get("query_type", "")).upper() == "NUMERIC" else "DESCRIPTION"
            records.append({
                "queryId": int(row["query_id"]),
                "queryType": query_type,
                "language": "hin_Deva",
                "englishQuery": compact(row.get("Eng_Query")),
                "translatedQuery": compact(row.get("query")),
                "englishAnswer": compact(row.get("Eng_Answer")),
                "translatedAnswer": compact(row.get("Answer")),
                "englishPassage": english_passage,
                "translatedPassage": translated_passage,
            })
        row_offset += len(rows)
    lines = [
        'import type { SourceDocument } from "./types";',
        "",
        "/**",
        " * Generated from ai4bharat/MSMARCO-XI validation/hinval.parquet using",
        " * scripts/build_compact_validation_docs.py. All query, answer, and",
        " * passage values are verbatim upstream records.",
        " */",
        "export const COMPACT_VALIDATION_DOCUMENTS: SourceDocument[] = [",
    ]
    for record in records:
        lines.extend([
            "  {",
            f"    queryId: {record['queryId']},",
            f"    queryType: {js(record['queryType'])},",
            f"    language: {js(record['language'])},",
            f"    englishQuery: {js(record['englishQuery'])},",
            f"    translatedQuery: {js(record['translatedQuery'])},",
            f"    englishAnswer: {js(record['englishAnswer'])},",
            f"    translatedAnswer: {js(record['translatedAnswer'])},",
            f"    englishPassage: {js(record['englishPassage'])},",
            f"    translatedPassage: {js(record['translatedPassage'])},",
            "  },",
        ])
    lines.append("];")
    output = Path(args.output)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "records": len(records), "targetPositions": len(targets)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
