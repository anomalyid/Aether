import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApi, createMemoryServices, seedDemo, type AetherServices } from "./index";
import type { DemoFixture } from "./container";

describe("Aether API", () => {
  let app: FastifyInstance;
  let services: AetherServices;
  let fixture: DemoFixture;

  beforeEach(async () => {
    services = createMemoryServices();
    fixture = await seedDemo(services);
    app = buildApi({ services });
    await app.ready();
  });

  const headers = () => ({
    "x-aether-tenant-id": fixture.tenant.id,
    "x-aether-principal-id": fixture.principal.id,
  });

  it("menyediakan health tanpa autentikasi", async () => {
    const response = await app.inject({ method: "GET", url: "/health/live" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("healthy");
  });

  it("menyajikan dokumen OpenAPI", async () => {
    const response = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.openapi).toBe("3.1.0");
    expect(response.json().data.paths["/v1/capabilities"]).toBeDefined();
  });

  it("menolak request tanpa tenant context", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/capabilities" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("TENANT_CONTEXT_REQUIRED");
    expect(response.json().meta.request_id).toBeTruthy();
  });

  it("menolak principal dari tenant lain", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/capabilities",
      headers: { "x-aether-tenant-id": "tenant_lain", "x-aether-principal-id": fixture.principal.id },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("AUTHORIZATION_DENIED");
  });

  it("mengembalikan daftar capability dengan format standar", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/capabilities", headers: headers() });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.error).toBeNull();
    expect(body.data.some((item: { id: string }) => item.id === "messaging.send")).toBe(true);
    expect(body.meta.request_id).toBeTruthy();
  });

  it("memanggil capability melalui pipeline", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/capabilities/messaging.send/invoke",
      headers: headers(),
      payload: { input: { destination: "62812", content: "Halo dari API" } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("completed");
    expect(response.json().data.output.messageId).toMatch(/^msg_/);
  });

  it("mengembalikan VALIDATION_ERROR untuk input tidak valid", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/capabilities/messaging.send/invoke",
      headers: headers(),
      payload: { input: { destination: "", content: "" } },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("menyediakan katalog dan instruksi skill", async () => {
    const catalog = await app.inject({ method: "GET", url: "/v1/skills", headers: headers() });
    expect(catalog.json().data[0]?.name).toBe("customer-support");

    const detail = await app.inject({
      method: "GET",
      url: "/v1/skills/customer-support",
      headers: headers(),
    });
    expect(detail.json().data.instructions).toContain("Customer Support");
  });

  it("menjalankan agent dan menampilkan execution", async () => {
    const runResponse = await app.inject({
      method: "POST",
      url: "/v1/agents/demo-agent/runs",
      headers: headers(),
      payload: { input: { pesan: "Halo" } },
    });
    expect(runResponse.statusCode).toBe(200);
    expect(runResponse.json().data.state).toBe("COMPLETED");

    const detail = await app.inject({
      method: "GET",
      url: `/v1/agents/runs/${runResponse.json().data.id}`,
      headers: headers(),
    });
    expect(detail.json().data.state).toBe("COMPLETED");

    const executions = await app.inject({ method: "GET", url: "/v1/executions", headers: headers() });
    expect(executions.json().data).toHaveLength(1);
  });

  it("menyediakan audit tenant dan menyembunyikan tenant lain", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/capabilities/messaging.send/invoke",
      headers: headers(),
      payload: { input: { destination: "62812", content: "Halo" } },
    });

    const response = await app.inject({ method: "GET", url: "/v1/audit-logs", headers: headers() });
    expect(response.json().data.length).toBeGreaterThan(0);

    const other = await app.inject({
      method: "GET",
      url: "/v1/audit-logs",
      headers: { ...headers(), "x-aether-tenant-id": "tenant_lain" },
    });
    expect(other.statusCode).toBe(403);
  });

  it("mengembalikan RESOURCE_NOT_FOUND untuk skill tidak ditemukan", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/skills/tidak-ada",
      headers: headers(),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("RESOURCE_NOT_FOUND");
  });
});
