"""Verify the supplied rag-local-eval-loop can resolve this project’s adapter.

This intentionally performs only target-contract verification. It does not
download MSMARCO-XI, load the embedding model, make judge calls, or touch the
production Qdrant deployment.
"""

from __future__ import annotations

from pathlib import Path

from eval.target import verify_target


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    resolved = verify_target(str(root))
    print(f"Evaluation adapter contract verified for: {resolved}")
