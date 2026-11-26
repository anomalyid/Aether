"""Test SDK Python Aether.

By Anomalyid.
"""

from __future__ import annotations

import json
import unittest
from typing import Any, Dict, Tuple
from urllib.request import Request

from aether_sdk import AetherApiError, AetherClient


class FakeTransport:
    def __init__(self, status: int, data: Any) -> None:
        self.status = status
        self.data = data
        self.requests = []

    def __call__(self, request: Request) -> Tuple[int, bytes]:
        self.requests.append(request)
        return self.status, json.dumps(self.data).encode("utf-8")


class AetherClientTest(unittest.TestCase):
    def setUp(self) -> None:
        self.transport = FakeTransport(200, {"data": [], "error": None, "meta": {"request_id": "req_1"}})
        self.client = AetherClient(
            base_url="http://localhost:3000/",
            tenant_id="tenant_1",
            principal_id="prin_1",
            transport=self.transport,
        )

    def test_tenant_context_setiap_request(self) -> None:
        self.client.capabilities.list()
        request = self.transport.requests[0]
        self.assertEqual(request.full_url, "http://localhost:3000/v1/capabilities")
        self.assertEqual(request.get_header("X-aether-tenant-id"), "tenant_1")
        self.assertEqual(request.get_header("X-aether-principal-id"), "prin_1")

    def test_memanggil_capability(self) -> None:
        self.transport.data = {"data": {"status": "completed"}, "error": None, "meta": {"request_id": "req_2"}}
        result = self.client.capabilities.invoke("messaging.send", {"destination": "62812"})
        self.assertEqual(result["status"], "completed")
        self.assertIn("messaging.send", self.transport.requests[0].full_url)

    def test_menjalankan_dan_menyetujui_agent(self) -> None:
        self.transport.data = {"data": {"id": "run_1", "state": "WAITING_APPROVAL"}, "error": None, "meta": {}}
        run = self.client.agents.run("asisten", {"pesan": "Halo"})
        self.assertEqual(run["state"], "WAITING_APPROVAL")

        self.transport.data = {"data": {"id": "run_1", "state": "COMPLETED"}, "error": None, "meta": {}}
        approved = self.client.agents.approve("run_1", "appr_1")
        self.assertEqual(approved["state"], "COMPLETED")

    def test_error_dipetakan(self) -> None:
        self.transport.status = 403
        self.transport.data = {
            "data": None,
            "error": {"code": "AUTHORIZATION_DENIED", "message": "Ditolak", "details": {}},
            "meta": {"request_id": "req_err"},
        }
        with self.assertRaises(AetherApiError) as caught:
            self.client.capabilities.list()
        self.assertEqual(caught.exception.code, "AUTHORIZATION_DENIED")
        self.assertEqual(caught.exception.status, 403)
        self.assertEqual(caught.exception.request_id, "req_err")


if __name__ == "__main__":
    unittest.main()
