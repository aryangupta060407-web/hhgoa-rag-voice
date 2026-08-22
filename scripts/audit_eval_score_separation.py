"""Measure top FAISS similarities for the supplied evaluator sample without generating answers."""

from __future__ import annotations

import argparse
import statistics
from pathlib import Path

from eval import dataset, index_build, target


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((len(ordered) - 1) * q))
    return ordered[index]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--answerable", type=int, default=25)
    parser.add_argument("--unanswerable", type=int, default=25)
    args = parser.parse_args()

    root = target.verify_target(Path.cwd())
    examples = dataset.load_examples(
        num_answerable=args.answerable,
        num_unanswerable=args.unanswerable,
        seed=42,
        language="hin",
        split="validation",
    )
    index, _ = index_build.build_index(examples)
    embed_one = target.get_embedder().embed_one

    grouped: dict[str, list[float]] = {"answerable": [], "unanswerable": []}
    for example in examples:
        scores, _ = index.search(embed_one(example.query_en).reshape(1, -1), 1)
        key = "answerable" if example.is_answerable else "unanswerable"
        grouped[key].append(float(scores[0][0]))

    print(f"Target project: {root}")
    for label, values in grouped.items():
        print(
            f"{label}: n={len(values)} min={min(values):.4f} p50={statistics.median(values):.4f} "
            f"p95={percentile(values, 0.95):.4f} max={max(values):.4f}"
        )

    for threshold in (0.90, 0.91, 0.92, 0.93, 0.94):
        accepted_answerable = sum(score >= threshold for score in grouped["answerable"])
        accepted_unanswerable = sum(score >= threshold for score in grouped["unanswerable"])
        print(
            f"threshold={threshold:.2f}: answerable_accept={accepted_answerable}/25 "
            f"unanswerable_accept={accepted_unanswerable}/25"
        )


if __name__ == "__main__":
    main()
