from __future__ import annotations

import hashlib
import math
import re
from typing import Iterable

from app.settings import EMBEDDING_DIMENSIONS

_WORD_RE = re.compile(r"[\w\u00C0-\u024F\u1E00-\u1EFF\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]+", re.UNICODE)


def _tokens(text: str) -> Iterable[str]:
    normalized = text.casefold().strip()
    words = _WORD_RE.findall(normalized)
    for word in words:
        yield f"w:{word}"
        if len(word) >= 3:
            for i in range(len(word) - 2):
                yield f"g:{word[i : i + 3]}"


def embed_text(text: str, dimensions: int = EMBEDDING_DIMENSIONS) -> list[float]:
    """Stable hashed n-gram embedding (EmbeddingGemma-compatible 768-d contract).

    Production can swap this backend for EmbeddingGemma weights while keeping
    the same HTTP contract and dimension enforcement.
    """
    if dimensions != EMBEDDING_DIMENSIONS:
        raise ValueError(f"dimensions must be {EMBEDDING_DIMENSIONS}")

    vec = [0.0] * dimensions
    count = 0
    for token in _tokens(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vec[idx] += sign
        count += 1

    if count == 0:
        # Empty input still returns a valid unit basis vector for dimension checks.
        vec[0] = 1.0
        return vec

    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]
