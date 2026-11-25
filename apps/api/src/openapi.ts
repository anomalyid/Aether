/**
 * Dokumen OpenAPI statis untuk API Aether v1.
 *
 * By Anomalyid.
 */

export const openapiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Aether API",
    version: "0.1.0",
    description: "Universal Agent & Intelligence Infrastructure — The Fabric of Intelligence.",
  },
  servers: [{ url: "/", description: "Deployment saat ini" }],
  security: [{ tenantContext: [] }],
  paths: {
    "/health/live": { get: { summary: "Liveness probe", security: [], responses: { 200: { description: "Proses aktif" } } } },
    "/health/ready": { get: { summary: "Readiness probe", security: [], responses: { 200: { description: "Siap melayani" } } } },
    "/v1/capabilities": {
      get: { summary: "Daftar capability yang tersedia", responses: { 200: { description: "Daftar capability" } } },
    },
    "/v1/capabilities/{id}/invoke": {
      post: {
        summary: "Memanggil capability melalui pipeline Aether",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["input"],
                properties: {
                  input: { type: "object" },
                  idempotencyKey: { type: "string" },
                  approvalId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Capability berhasil dipanggil" },
          400: { description: "VALIDATION_ERROR" },
          401: { description: "AUTHENTICATION_REQUIRED" },
          403: { description: "AUTHORIZATION_DENIED / POLICY_BLOCKED" },
          428: { description: "APPROVAL_REQUIRED" },
        },
      },
    },
    "/v1/agents": { get: { summary: "Daftar agent", responses: { 200: { description: "Daftar agent" } } } },
    "/v1/agents/{id}/runs": {
      post: {
        summary: "Menjalankan agent",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { input: { type: "object" } } } } },
        },
        responses: { 200: { description: "Agent run dibuat" }, 403: { description: "Ditolak" } },
      },
    },
    "/v1/agents/runs/{runId}": {
      get: {
        summary: "Melihat agent run",
        parameters: [{ name: "runId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Detail run" }, 404: { description: "RESOURCE_NOT_FOUND" } },
      },
    },
    "/v1/agents/runs/{runId}/approve": {
      post: {
        summary: "Melanjutkan run setelah approval",
        parameters: [{ name: "runId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["approvalId"], properties: { approvalId: { type: "string" } } } } },
        },
        responses: { 200: { description: "Run dilanjutkan" }, 409: { description: "RESOURCE_CONFLICT" } },
      },
    },
    "/v1/skills": { get: { summary: "Katalog skill", responses: { 200: { description: "Daftar skill" } } } },
    "/v1/skills/{id}": {
      get: {
        summary: "Memuat instruksi skill",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Instruksi skill" }, 404: { description: "RESOURCE_NOT_FOUND" } },
      },
    },
    "/v1/approvals/{id}": {
      get: {
        summary: "Melihat approval",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Detail approval" } },
      },
    },
    "/v1/audit-logs": {
      get: {
        summary: "Riwayat audit tenant",
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 100 } }],
        responses: { 200: { description: "Daftar audit" } },
      },
    },
    "/v1/executions": { get: { summary: "Daftar agent run tenant", responses: { 200: { description: "Daftar execution" } } } },
    "/v1/models": { get: { summary: "Daftar model provider", responses: { 200: { description: "Daftar provider" } } } },
    "/openapi.json": { get: { summary: "Spesifikasi OpenAPI ini", security: [], responses: { 200: { description: "OpenAPI document" } } } },
  },
  components: {
    securitySchemes: {
      tenantContext: {
        type: "apiKey",
        in: "header",
        name: "x-aether-tenant-id",
        description: "Tenant context tervalidasi. Principal dikirim melalui x-aether-principal-id.",
      },
    },
    schemas: {
      SuccessResponse: {
        type: "object",
        required: ["data", "meta", "error"],
        properties: {
          data: {},
          meta: { type: "object", properties: { request_id: { type: "string" } } },
          error: { type: "null" },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["data", "meta", "error"],
        properties: {
          data: { type: "null" },
          meta: { type: "object", properties: { request_id: { type: "string" } } },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              category: { type: "string" },
              retryable: { type: "boolean" },
              details: { type: "object" },
            },
          },
        },
      },
    },
  },
} as const;
