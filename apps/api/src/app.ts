/**
 * API HTTP Aether — kontrak /v1 dengan response dan error standar.
 *
 * By Anomalyid.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { AetherError, ErrorCode, isAetherError, normalizeError } from "@aether/errors";
import { createExecutionContext, type AetherExecutionContext } from "@aether/context";
import { openapiDocument } from "./openapi.js";
import { createMemoryServices, type AetherServices } from "./container.js";

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_REQUIRED: 401,
  AUTHORIZATION_DENIED: 403,
  TENANT_CONTEXT_REQUIRED: 400,
  RESOURCE_NOT_FOUND: 404,
  RESOURCE_CONFLICT: 409,
  RATE_LIMITED: 429,
  APPROVAL_REQUIRED: 428,
  POLICY_BLOCKED: 403,
  DEPENDENCY_UNAVAILABLE: 503,
  PROVIDER_UNAVAILABLE: 503,
  EXECUTION_TIMEOUT: 504,
  EXECUTION_CANCELLED: 409,
  IDEMPOTENCY_CONFLICT: 409,
};

type RequestWithContext = { aetherContext?: AetherExecutionContext };

interface InvokeBody {
  input?: Record<string, unknown>;
  idempotencyKey?: string;
  approvalId?: string;
}

interface RunBody {
  input?: Record<string, unknown>;
}

interface ApproveBody {
  approvalId: string;
}

export interface BuildApiOptions {
  services?: AetherServices;
}

export function buildApi(options: BuildApiOptions = {}): FastifyInstance {
  const services = options.services ?? createMemoryServices();
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, request, reply) => {
    const aetherError = isAetherError(error) ? error : normalizeError(error);
    const status = STATUS_BY_CODE[aetherError.code] ?? 500;
    void reply.code(status).send({
      data: null,
      meta: { request_id: request.id },
      error: aetherError.toJSON(),
    });
  });

  app.addHook("preHandler", async (request) => {
    const path = request.url.split("?")[0] ?? "";
    if (path.startsWith("/health") || path === "/openapi.json") return;

    const tenantId = request.headers["x-aether-tenant-id"];
    const principalId = request.headers["x-aether-principal-id"];

    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.TENANT_CONTEXT_REQUIRED,
        "Header x-aether-tenant-id wajib disertakan.",
        { category: "authorization", retryable: false },
      );
    }
    if (typeof principalId !== "string" || principalId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.AUTHENTICATION_REQUIRED,
        "Header x-aether-principal-id wajib disertakan.",
        { category: "authorization", retryable: false },
      );
    }

    await services.principals.assertInTenant(principalId, tenantId);
    (request as RequestWithContext).aetherContext = createExecutionContext({
      actorType: "agent",
      tenantId,
      principalId,
      requestId: request.id,
    });
  });

  const success = (
    reply: { send(payload: unknown): unknown },
    data: unknown,
    requestId: string,
  ) => reply.send({ data, error: null, meta: { request_id: requestId } });

  app.get("/health/live", async (request, reply) =>
    success(reply, { status: "healthy", checkedAt: new Date().toISOString() }, request.id),
  );
  app.get("/health/ready", async (request, reply) =>
    success(reply, { status: "healthy", checkedAt: new Date().toISOString() }, request.id),
  );
  app.get("/health/dependencies", async (request, reply) =>
    success(reply, { status: "healthy", checkedAt: new Date().toISOString() }, request.id),
  );

  app.get("/openapi.json", async (request, reply) => success(reply, openapiDocument, request.id));

  app.get("/v1/capabilities", async (request, reply) => {
    const context = (request as RequestWithContext).aetherContext;
    const data = await services.capabilityRegistry.discover(context?.tenantId);
    return success(reply, data, request.id);
  });

  app.post<{ Params: { id: string }; Body: InvokeBody }>(
    "/v1/capabilities/:id/invoke",
    async (request, reply) => {
      const context = (request as RequestWithContext).aetherContext;
      if (context?.tenantId === undefined || context.principalId === undefined) {
        throw new AetherError(ErrorCode.TENANT_CONTEXT_REQUIRED, "Context tidak tersedia.", {
          category: "authorization",
          retryable: false,
        });
      }
      const body = request.body ?? {};
      const result = await services.capabilities.invoke({
        capabilityId: request.params.id,
        input: body.input ?? {},
        principal: {
          tenantId: context.tenantId,
          principalId: context.principalId,
          actorType: "agent",
        },
        tenantId: context.tenantId,
        correlationId: context.correlationId,
        ...(body.idempotencyKey === undefined ? {} : { idempotencyKey: body.idempotencyKey }),
        ...(body.approvalId === undefined ? {} : { approvalId: body.approvalId }),
      });
      const status = result.status === "awaiting_approval" ? 202 : 200;
      void reply.code(status);
      return success(reply, result, request.id);
    },
  );

  app.get("/v1/agents", async (request, reply) => {
    const context = (request as RequestWithContext).aetherContext;
    const data = (await services.agentDefinitions.list(context?.tenantId)).map((definition) => ({
      id: definition.id,
      version: definition.version,
      name: definition.name,
      enabled: definition.enabled,
      capabilities: definition.capabilities.allowed,
    }));
    return success(reply, data, request.id);
  });

  app.post<{ Params: { id: string }; Body: RunBody }>(
    "/v1/agents/:id/runs",
    async (request, reply) => {
      const context = (request as RequestWithContext).aetherContext;
      if (context?.tenantId === undefined || context.principalId === undefined) {
        throw new AetherError(ErrorCode.TENANT_CONTEXT_REQUIRED, "Context tidak tersedia.", {
          category: "authorization",
          retryable: false,
        });
      }
      const run = await services.runtime.start({
        agentId: request.params.id,
        tenantId: context.tenantId,
        principalId: context.principalId,
        input: request.body?.input ?? {},
        correlationId: context.correlationId,
      });
      return success(reply, run, request.id);
    },
  );

  app.get<{ Params: { runId: string } }>("/v1/agents/runs/:runId", async (request, reply) => {
    const context = (request as RequestWithContext).aetherContext;
    const run = await services.runtime.getRun(request.params.runId, context?.tenantId ?? "");
    return success(reply, run, request.id);
  });

  app.post<{ Params: { runId: string }; Body: ApproveBody }>(
    "/v1/agents/runs/:runId/approve",
    async (request, reply) => {
      const context = (request as RequestWithContext).aetherContext;
      if (request.body?.approvalId === undefined || request.body.approvalId.trim().length === 0) {
        throw new AetherError(ErrorCode.VALIDATION_ERROR, "approvalId wajib diisi.", {
          category: "validation",
          retryable: false,
        });
      }
      const run = await services.runtime.resume(
        request.params.runId,
        context?.tenantId ?? "",
        request.body.approvalId,
      );
      return success(reply, run, request.id);
    },
  );

  app.get("/v1/skills", async (request, reply) =>
    success(reply, services.skills.catalog(), request.id),
  );

  app.get<{ Params: { id: string } }>("/v1/skills/:id", async (request, reply) =>
    success(reply, { instructions: services.skills.load(request.params.id) }, request.id),
  );

  app.get<{ Params: { id: string } }>("/v1/approvals/:id", async (request, reply) => {
    const context = (request as RequestWithContext).aetherContext;
    const record = await services.approvals.get(request.params.id, context?.tenantId ?? "");
    return success(reply, record, request.id);
  });

  app.get<{ Querystring: { limit?: string } }>("/v1/audit-logs", async (request, reply) => {
    const context = (request as RequestWithContext).aetherContext;
    const limit = Number(request.query.limit ?? 100);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100;
    return success(reply, await services.audit.list(context?.tenantId ?? "", safeLimit), request.id);
  });

  app.get("/v1/executions", async (request, reply) => {
    const context = (request as RequestWithContext).aetherContext;
    return success(reply, await services.runtime.listRuns(context?.tenantId ?? ""), request.id);
  });

  app.get("/v1/models", async (request, reply) =>
    success(reply, services.models.listProviders(), request.id),
  );

  return app;
}
