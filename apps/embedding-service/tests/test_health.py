import unittest

from app.settings import EMBEDDING_DIMENSIONS, MODEL_NAME


class EmbeddingServiceFoundationTests(unittest.TestCase):
    def test_model_dimensions(self) -> None:
        self.assertEqual(EMBEDDING_DIMENSIONS, 768)
        self.assertEqual(MODEL_NAME, "embeddinggemma-300m")

    def test_health_payload_shape(self) -> None:
        try:
            from app.main import health, model_info
        except ModuleNotFoundError as error:
            self.skipTest(f"FastAPI not installed: {error}")

        self.assertEqual(health()["status"], "ok")
        self.assertEqual(model_info()["dimensions"], 768)


if __name__ == "__main__":
    unittest.main()
