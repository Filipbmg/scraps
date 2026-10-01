import unittest

from httpx import ASGITransport, AsyncClient

from app.main import app


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_health_and_dashboard_contract(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            self.assertEqual((await client.get("/api/health")).json()["status"], "ok")
            response = await client.get("/api/dashboard")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["mode"], "demo")
        source_ids = {source["id"] for source in data["sources"]}
        self.assertTrue(all(m["source_id"] in source_ids for m in data["mentions"]))
        for period in data["periods"].values():
            self.assertEqual(sum(period["sentiment"].values()), 100)
            self.assertEqual(
                sum(p["news"] + p["social"] + p["other"] for p in period["trend"]),
                period["mentions"],
            )
        self.assertEqual(sum(s["mentions"] for s in data["sources"]), 1248)


if __name__ == "__main__":
    unittest.main()
