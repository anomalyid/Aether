"""Typed client untuk API Aether /v1.

Memakai urllib dari standard library agar tidak ada dependency eksternal.

By Anomalyid.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Dict, Optional, Tuple
from urllib.request import Request, urlopen

Transport = Callable[[Request], Tuple[int, bytes]]


class AetherApiError(Exception):
    """Error yang dipetakan dari response error Aether."""

    def __init__(
        self,
        code: str,
        message: str,
        status: int,
        request_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.request_id = request_id
        self.details = details or {}


class _Resource:
    def __init__(self, client: "AetherClient") -> None:
        self._client = client


class _Capabilities(_Resource):
    def list(self) -> Any:
        return self._client.request("GET", "/v1/capabilities")

    def invoke(
        self,
        capability_id: str,
        input_data: Dict[str, Any],
        idempotency_key: Optional[str] = None,
        approval_id: Optional[str] = None,
    ) -> Any:
        body: Dict[str, Any] = {"input": input_data}
        if idempotency_key is not None:
            body["idempotencyKey"] = idempotency_key
        if approval_id is not None:
            body["approvalId"] = approval_id
        return self._client.request(
            "POST", f"/v1/capabilities/{capability_id}/invoke", body
        )


class _Agents(_Resource):
    def list(self) -> Any:
        return self._client.request("GET", "/v1/agents")

    def run(self, agent_id: str, input_data: Dict[str, Any]) -> Any:
        return self._client.request(
            "POST", f"/v1/agents/{agent_id}/runs", {"input": input_data}
        )

    def get_run(self, run_id: str) -> Any:
        return self._client.request("GET", f"/v1/agents/runs/{run_id}")

    def approve(self, run_id: str, approval_id: str) -> Any:
        return self._client.request(
            "POST", f"/v1/agents/runs/{run_id}/approve", {"approvalId": approval_id}
        )


class _Skills(_Resource):
    def list(self) -> Any:
        return self._client.request("GET", "/v1/skills")

    def get(self, skill_id: str) -> Any:
        return self._client.request("GET", f"/v1/skills/{skill_id}")


class _Audit(_Resource):
    def list(self, limit: int = 100) -> Any:
        return self._client.request("GET", f"/v1/audit-logs?limit={limit}")


def _default_transport(request: Request) -> Tuple[int, bytes]:
    with urlopen(request, timeout=30) as response:  # noqa: S310 - URL berasal dari konfigurasi
        return int(response.status), response.read()


class AetherClient:
    """Client API Aether dengan tenant context pada setiap request."""

    def __init__(
        self,
        base_url: str,
        tenant_id: str,
        principal_id: str,
        api_key: Optional[str] = None,
        transport: Optional[Transport] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.tenant_id = tenant_id
        self.principal_id = principal_id
        self.api_key = api_key
        self._transport = transport or _default_transport

        self.capabilities = _Capabilities(self)
        self.agents = _Agents(self)
        self.skills = _Skills(self)
        self.audit = _Audit(self)

    def request(
        self, method: str, path: str, body: Optional[Dict[str, Any]] = None
    ) -> Any:
        headers = {
            "Content-Type": "application/json",
            "x-aether-tenant-id": self.tenant_id,
            "x-aether-principal-id": self.principal_id,
        }
        if self.api_key is not None:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = json.dumps(body).encode("utf-8") if body is not None else None
        request = Request(f"{self.base_url}{path}", data=payload, headers=headers, method=method)
        status, raw = self._transport(request)
        response = json.loads(raw.decode("utf-8"))

        error = response.get("error")
        if status >= 400 or error is not None:
            error = error or {}
            meta = response.get("meta") or {}
            raise AetherApiError(
                code=str(error.get("code", "INTERNAL_ERROR")),
                message=str(error.get("message", f"HTTP {status}")),
                status=status,
                request_id=meta.get("request_id"),
                details=error.get("details"),
            )
        return response.get("data")
