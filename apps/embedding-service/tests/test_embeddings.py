import unittest

from fastapi.testclient import TestClient

from app.embedder import embed_text
from app.main import app
from app.settings import EMBEDDING_DIMENSIONS, MODEL_NAME


class EmbeddingServiceTests(unittest.TestCase):
    def test_model_dimensions(self) -> None:
        self.assertEqual(EMBEDDING_DIMENSIONS, 768)
        self.assertEqual(MODEL_NAME, "embeddinggemma-300m")

    def test_embed_text_dimension_and_stability(self) -> None:
        a = embed_text("Pool hours 06:00-22:00")
        b = embed_text("Pool hours 06:00-22:00")
        self.assertEqual(len(a), 768)
        self.assertEqual(a, b)
        norm = sum(v * v for v in a) ** 0.5
        self.assertAlmostEqual(norm, 1.0, places=5)

    def test_embeddings_endpoint_enforces_tenant_batch(self) -> None:
        client = TestClient(app)
        response = client.post(
            "/v1/embeddings",
            json={
                "organizationId": "org-a",
                "propertyId": "prop-1",
                "inputs": [
                    {"id": "1", "text": "Wi-Fi password aurora-guest"},
                    {"id": "2", "text": "Breakfast 06:30-10:00"},
                ],
            },
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["dimensions"], 768)
        self.assertEqual(body["organizationId"], "org-a")
        self.assertEqual(len(body["embeddings"]), 2)
        self.assertEqual(len(body["embeddings"][0]["embedding"]), 768)

    def test_embeddings_reject_missing_org(self) -> None:
        client = TestClient(app)
        response = client.post(
            "/v1/embeddings",
            json={"organizationId": "", "inputs": [{"id": "1", "text": "hello"}]},
        )
        self.assertIn(response.status_code, (400, 422))


if __name__ == "__main__":
    unittest.main()
