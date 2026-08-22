"""Project-native embedding adapter for the external evaluation loop.

The deployed gateway uses the same multilingual E5 model with raw text (no
query/passage prefix). This adapter deliberately exposes that real encoder to
the evaluator without changing the production Qdrant retrieval service.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Sequence

import numpy as np

MODEL_NAME = os.environ.get("EVAL_DENSE_MODEL", "intfloat/multilingual-e5-small")


@lru_cache(maxsize=1)
def get_model():
    """Load the exact dense encoder used by the deterministic gateway once."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)


def embed(texts: list[str] | Sequence[str]) -> np.ndarray:
    """Return one normalized dense vector per input text for the eval index."""
    values = list(texts)
    if not all(isinstance(value, str) for value in values):
        raise TypeError("embed expects a sequence of strings")
    return np.asarray(
        get_model().encode(values, show_progress_bar=False, convert_to_numpy=True),
        dtype=np.float32,
    )


def embed_one(text: str) -> np.ndarray:
    """Return a single vector with the evaluator-required shape contract."""
    if not isinstance(text, str):
        raise TypeError("embed_one expects a string")
    return embed([text])[0]
