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
# Extraction requires substantial coverage of the *specific subject anchors*,
# not merely overlap on broad question words. This is deliberately a lexical
# guard: it uses no labels, answer key, or generative model.
MIN_ANCHOR_COVERAGE = 0.75
STOP_WORDS = {
    "a", "an", "and", "are", "at", "be", "by", "does", "do", "did", "for", "from", "has", "have",
    "how", "in", "is", "it", "of", "on", "or", "the", "to", "what", "which", "who", "why", "with",
    "can", "could", "should", "would", "will", "was", "were", "when", "where", "my", "your",
    # Common Marathi function and question words. Keeping these out of the
    # subject-anchor set prevents grammatical overlap from becoming evidence.
    "आहे", "आणि", "का", "काय", "कशी", "कसा", "कसे", "किती", "कोण", "कोणत्या", "चा", "ची", "चे",
    "ते", "तो", "ती", "मध्ये", "माझे", "माझा", "माझी", "या", "हे", "होते", "होता", "होती", "साठी",
}
GENERIC_QUESTION_TERMS = {
    "fast", "speed", "travel", "quick", "quickly", "long", "time", "times", "year", "years", "work",
    "works", "history", "meaning", "mean", "define", "definition", "effect", "effects", "cost", "costs",
    "price", "prices", "rate", "rates",
}
RELATION_TERMS = {
    "about", "after", "around", "before", "between", "during", "for", "from", "near", "of",
    "related", "than", "through", "under", "versus", "via", "with", "without",
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
        for token in re.findall(r"[^\W_]+", text.lower(), flags=re.UNICODE)
        if token not in STOP_WORDS
    ]


def _best_sentence(query: str, content: str) -> tuple[str, float, float]:
    query_tokens = _tokens(query)
    anchors = [
        token for token in query_tokens
        if token not in GENERIC_QUESTION_TERMS and token not in RELATION_TERMS
    ]
    if not anchors:
        return "", 0.0, 0.0

    best_sentence = ""
    best_coverage = 0.0
    best_anchor_coverage = 0.0
    sentences = [sentence.strip() for sentence in re.findall(r"[^.!?]+[.!?]?", content) if sentence.strip()] or [content]
    for sentence in sentences:
        sentence_tokens = set(_tokens(sentence))
        coverage = sum(token in sentence_tokens for token in query_tokens) / max(1, len(query_tokens))
        anchor_coverage = sum(anchor in sentence_tokens for anchor in anchors) / len(anchors)
        if (anchor_coverage, coverage) > (best_anchor_coverage, best_coverage):
            best_sentence, best_coverage, best_anchor_coverage = sentence, coverage, anchor_coverage
    return best_sentence, best_coverage, best_anchor_coverage


def generate_answer(query: str, results: list[Any]) -> EvalAnswer:
    """Select grounded evidence from evaluator-supplied contexts or refuse."""
    started = time.perf_counter()
    best: tuple[str, float] | None = None
    for result in results:
        sentence, coverage, anchor_coverage = _best_sentence(query, str(result.text))
        if (
            anchor_coverage >= MIN_ANCHOR_COVERAGE
            and coverage >= MIN_COVERAGE
            and (best is None or coverage > best[1])
        ):
            best = (sentence, coverage)

    elapsed = round((time.perf_counter() - started) * 1000, 3)
    if best is None:
        return EvalAnswer(text=REFUSAL, grounded=False, generation_ms=elapsed)
    return EvalAnswer(text=best[0], grounded=True, generation_ms=elapsed)
