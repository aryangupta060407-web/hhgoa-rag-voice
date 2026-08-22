"""Deterministic extractive generator adapter for the external evaluation loop.

No generative model is used. The function selects a sentence only when a
meaningful subject anchor and enough lexical evidence appear in the supplied
retrieved context; otherwise it returns an explicit refusal.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any


REFUSAL = "I couldn't find enough relevant information in the provided dataset to answer this question."
MIN_COVERAGE = 0.30
STOP_WORDS = {
    "a", "an", "and", "are", "at", "be", "by", "does", "do", "did", "for", "from", "has", "have",
    "how", "in", "is", "it", "of", "on", "or", "the", "to", "what", "which", "who", "why", "with",
    "can", "could", "should", "would", "will", "was", "were", "when", "where", "my", "your",
}
GENERIC_QUESTION_TERMS = {
    "fast", "speed", "travel", "quick", "quickly", "long", "time", "times", "year", "years", "work",
    "works", "history", "meaning", "mean", "define", "definition", "effect", "effects", "cost", "costs",
    "price", "prices", "rate", "rates",
}


@dataclass(frozen=True)
class EvalAnswer:
    text: str
    grounded: bool
    generation_ms: float
    model: str = "deterministic-extractive-no-llm"


def _tokens(text: str) -> list[str]:
    return [
        token[:-1] if len(token) > 4 and token.endswith("s") else token
        for token in re.findall(r"[A-Za-z0-9]+", text.lower())
        if token not in STOP_WORDS
    ]


def _best_sentence(query: str, content: str) -> tuple[str, float, bool]:
    query_tokens = _tokens(query)
    anchors = [token for token in query_tokens if token not in GENERIC_QUESTION_TERMS]
    if not anchors:
        return "", 0.0, False

    best_sentence = ""
    best_coverage = 0.0
    best_anchor_match = False
    sentences = [sentence.strip() for sentence in re.findall(r"[^.!?]+[.!?]?", content) if sentence.strip()] or [content]
    for sentence in sentences:
        sentence_tokens = set(_tokens(sentence))
        coverage = sum(token in sentence_tokens for token in query_tokens) / max(1, len(query_tokens))
        anchor_match = any(anchor in sentence_tokens for anchor in anchors)
        if (anchor_match, coverage) > (best_anchor_match, best_coverage):
            best_sentence, best_coverage, best_anchor_match = sentence, coverage, anchor_match
    return best_sentence, best_coverage, best_anchor_match


def generate_answer(query: str, results: list[Any]) -> EvalAnswer:
    """Select grounded evidence from evaluator-supplied contexts or refuse."""
    started = time.perf_counter()
    best: tuple[str, float] | None = None
    for result in results:
        sentence, coverage, anchor_match = _best_sentence(query, str(result.text))
        if anchor_match and coverage >= MIN_COVERAGE and (best is None or coverage > best[1]):
            best = (sentence, coverage)

    elapsed = round((time.perf_counter() - started) * 1000, 3)
    if best is None:
        return EvalAnswer(text=REFUSAL, grounded=False, generation_ms=elapsed)
    return EvalAnswer(text=best[0], grounded=True, generation_ms=elapsed)
