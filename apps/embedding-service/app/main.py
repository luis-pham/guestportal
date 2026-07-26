from fastapi import FastAPI

from app.settings import EMBEDDING_DIMENSIONS, MODEL_NAME

app = FastAPI(title="GuestPortal Embedding Service", version="0.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "embedding-service"}


@app.get("/v1/model")
def model_info() -> dict[str, object]:
    return {
        "model": MODEL_NAME,
        "dimensions": EMBEDDING_DIMENSIONS,
        "status": "foundation",
        "ready": False,
        "message": "Model loading lands in Phase 05. Health endpoint is available now.",
    }
