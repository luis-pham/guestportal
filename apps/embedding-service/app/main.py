from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.embedder import embed_text
from app.settings import EMBEDDING_DIMENSIONS, MODEL_NAME

app = FastAPI(title="GuestPortal Embedding Service", version="0.1.0")


class EmbeddingItem(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1, max_length=20_000)


class EmbeddingRequest(BaseModel):
    organizationId: str = Field(min_length=1, max_length=64)
    propertyId: Optional[str] = Field(default=None, max_length=64)
    inputs: List[EmbeddingItem] = Field(min_length=1, max_length=64)


class EmbeddingResult(BaseModel):
    id: str
    embedding: List[float]
    dimensions: int


class EmbeddingResponse(BaseModel):
    model: str
    dimensions: int
    organizationId: str
    embeddings: List[EmbeddingResult]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "embedding-service"}


@app.get("/v1/model")
def model_info() -> dict[str, object]:
    return {
        "model": MODEL_NAME,
        "dimensions": EMBEDDING_DIMENSIONS,
        "status": "ready",
        "ready": True,
        "backend": "hashed-ngram-v1",
        "message": "Returns exact 768-d L2-normalized vectors via stable hashed n-grams (EmbeddingGemma contract).",
    }


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
def create_embeddings(body: EmbeddingRequest) -> EmbeddingResponse:
    # Tenant isolation: one organization per request; reject empty/mixed batches upstream.
    if not body.organizationId.strip():
        raise HTTPException(status_code=400, detail="organizationId is required")

    results: list[EmbeddingResult] = []
    for item in body.inputs:
        vector = embed_text(item.text)
        if len(vector) != EMBEDDING_DIMENSIONS:
            raise HTTPException(status_code=500, detail="embedding dimension mismatch")
        results.append(
            EmbeddingResult(id=item.id, embedding=vector, dimensions=EMBEDDING_DIMENSIONS)
        )

    return EmbeddingResponse(
        model=MODEL_NAME,
        dimensions=EMBEDDING_DIMENSIONS,
        organizationId=body.organizationId,
        embeddings=results,
    )
