/**
 * Capability Engine — pipeline eksekusi kanonik Aether.
 *
 * AUTHENTICATE → RESOLVE → VALIDATE INPUT → CHECK TENANT → AUTHORIZE
 * → RISK → APPROVAL → EXECUTE → VALIDATE OUTPUT → AUDIT → EVENT.
 *
 * Tidak ada jalur pintas yang melewati policy.
 *
 * By Anomalyid.
 */

import { createHash } from "node:crypto";
import { createId } from "@aether/identifiers";
import { AetherError, ErrorCode, normalizeError, redactSecrets } from "@aether/errors";
import { validateJsonSchema } from "./schema-validator.js";
import { CapabilityRegistry } from "./registry.js";
import type {
  ApprovalPort,
  AuditPort,
  CapabilityDefinition,
  DomainEvent,
  EventPublisherPort,
  IdempotencyStore,
  InvocationRequest,
  InvocationResult,
  PolicyEvaluatorPort,
  ProviderExecutor,
} from "./types.js";

export interface CapabilityEngineDependencies {
  registry: CapabilityRegistry;
  executor: ProviderExecutor;
  policy: PolicyEvaluatorPort;
  approvals: ApprovalPort;
  audit: AuditPort;
  events: EventPublisherPort;
  idempotency: IdempotencyStore;
}

function canonicalDigest(value: unknown): string {
  const sorted = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sorted);
    if (input !== null && typeof input === "object") {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(input).sort()) {
        result[key] = sorted((input as Record<string, unknown>)[key]);
      }
      return result;
    }
    return input;
  };
  return createHash("sha256").update(JSON.stringify(sorted(value))).digest("hex");
}

async function withTimeout<T>(operation: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new AetherError(ErrorCode.EXECUTION_TIMEOUT, `Eksekusi melebihi batas ${ms} ms.`, {
          category: "execution",
          retryable: true,
          details: { timeoutMs: ms },
        }),
      );
    }, ms);
  });
  try {
    return await Promise.race([operation(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export class CapabilityEngine {
  constructor(private readonly dependencies: CapabilityEngineDependencies) {}

  async invoke(request: InvocationRequest): Promise<InvocationResult> {
    const invocationId = createId("inv");
    const tenantId = request.tenantId;

    if (tenantId === undefined || tenantId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.TENANT_CONTEXT_REQUIRED,
        "Tenant context wajib untuk invocation.",
        { category: "authorization", retryable: false },
      );
    }
    if (request.principal.tenantId !== tenantId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Principal tidak berasal dari tenant ini.",
        { category: "authorization", retryable: false },
      );
    }

    const capability = await this.dependencies.registry.resolve(
      request.capabilityId,
      request.version,
      tenantId,
    );

    const inputValidation = validateJsonSchema(capability.inputSchema, request.input);
    if (!inputValidation.valid) {
      await this.auditSafely(request, capability, "failed", { errors: inputValidation.errors });
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Input capability tidak valid.", {
        category: "validation",
        retryable: false,
        details: { errors: inputValidation.errors },
      });
    }

    const decision = await this.dependencies.policy.evaluate({
      principal: request.principal,
      action: "capability.invoke",
      resource: capability.provider,
      capability: capability.id,
      riskLevel: capability.riskLevel,
    });

    if (decision.decision === "deny") {
      await this.auditSafely(request, capability, "denied", { reasonCode: decision.reasonCode });
      const code =
        decision.reasonCode === "PERMISSION_MISSING"
          ? ErrorCode.AUTHORIZATION_DENIED
          : ErrorCode.POLICY_BLOCKED;
      throw new AetherError(code, "Capability tidak diizinkan untuk principal ini.", {
        category: "authorization",
        retryable: false,
        details: { reasonCode: decision.reasonCode, policyIds: decision.policyIds },
      });
    }

    if (decision.decision === "require_approval") {
      if (request.approvalId === undefined) {
        const approval = await this.dependencies.approvals.create({
          tenantId,
          requesterPrincipalId: request.principal.principalId,
          ...(request.agentRunId === undefined ? {} : { agentRunId: request.agentRunId }),
          capabilityId: capability.id,
          resourceReference: capability.provider,
          parameters: request.input,
          riskLevel: capability.riskLevel,
        });
        await this.auditSafely(request, capability, "approval", { approvalId: approval.id });
        await this.publishSafely(request, "capability.approval_requested", {
          capabilityId: capability.id,
          approvalId: approval.id,
        });
        return {
          invocationId,
          capabilityId: capability.id,
          status: "awaiting_approval",
          approvalId: approval.id,
        };
      }

      await this.dependencies.approvals.assertApproved(
        request.approvalId,
        tenantId,
        capability.id,
        request.input,
      );
    }

    const idempotencyKey = await this.resolveIdempotencyKey(capability, request);
    if (idempotencyKey !== undefined) {
      const existing = await this.dependencies.idempotency.find(idempotencyKey, tenantId);
      if (existing !== null) {
        if (existing.inputDigest !== canonicalDigest(redactSecrets(request.input))) {
          throw new AetherError(
            ErrorCode.IDEMPOTENCY_CONFLICT,
            "Idempotency key digunakan dengan input yang berbeda.",
            { category: "execution", retryable: false },
          );
        }
        return { ...existing.result, replayed: true };
      }
    }

    let output: unknown;
    try {
      output = await withTimeout(
        () =>
          this.dependencies.executor.execute(capability.id, request.input, {
            invocationId,
            tenantId,
            principalId: request.principal.principalId,
            ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
            ...(request.agentRunId === undefined ? {} : { agentRunId: request.agentRunId }),
          }),
        capability.timeoutMs,
      );
    } catch (error) {
      const normalized = normalizeError(error, ErrorCode.PROVIDER_UNAVAILABLE);
      await this.auditSafely(request, capability, "failed", { code: normalized.code });
      await this.publishSafely(request, "capability.failed", {
        capabilityId: capability.id,
        error: normalized.toJSON(),
      });
      throw normalized;
    }

    const outputValidation = validateJsonSchema(capability.outputSchema, output);
    if (!outputValidation.valid) {
      await this.auditSafely(request, capability, "failed", { errors: outputValidation.errors });
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Output capability tidak valid.", {
        category: "execution",
        retryable: false,
        details: { errors: outputValidation.errors },
      });
    }

    const result: InvocationResult = {
      invocationId,
      capabilityId: capability.id,
      status: "completed",
      output,
    };

    if (idempotencyKey !== undefined) {
      await this.dependencies.idempotency.save({
        key: idempotencyKey,
        tenantId,
        inputDigest: canonicalDigest(redactSecrets(request.input)),
        result,
        createdAt: new Date().toISOString(),
      });
    }

    const audit = await this.dependencies.audit.record({
      tenantId,
      principalId: request.principal.principalId,
      actorType: request.principal.actorType,
      action: "capability.invoke",
      resource: capability.id,
      outcome: "executed",
      ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
      details: { invocationId, provider: capability.provider },
    });
    await this.publishSafely(request, "capability.invoked", {
      capabilityId: capability.id,
      invocationId,
      provider: capability.provider,
    });

    return { ...result, auditId: audit.id };
  }

  private async resolveIdempotencyKey(
    capability: CapabilityDefinition,
    request: InvocationRequest,
  ): Promise<string | undefined> {
    if (capability.idempotency === "unsupported") return undefined;
    if (request.idempotencyKey === undefined || request.idempotencyKey.trim().length === 0) {
      if (capability.idempotency === "required") {
        throw new AetherError(
          ErrorCode.VALIDATION_ERROR,
          "Capability ini mewajibkan idempotency key.",
          { category: "validation", retryable: false },
        );
      }
      return undefined;
    }
    return `${request.tenantId}:${capability.id}:${request.idempotencyKey}`;
  }

  private async auditSafely(
    request: InvocationRequest,
    capability: CapabilityDefinition,
    outcome: "denied" | "failed" | "approval",
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.dependencies.audit.record({
        tenantId: request.tenantId,
        principalId: request.principal.principalId,
        actorType: request.principal.actorType,
        action: "capability.invoke",
        resource: capability.id,
        outcome,
        ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
        details: redactSecrets(details) as Record<string, unknown>,
      });
    } catch {
      // Audit gagal tidak boleh mengubah keputusan keamanan, tetapi harus diamati.
    }
  }

  private async publishSafely(
    request: InvocationRequest,
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const event: DomainEvent = {
      id: createId("evt"),
      type,
      version: 1,
      tenantId: request.tenantId,
      occurredAt: new Date().toISOString(),
      ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
      source: "capability.engine",
      data: redactSecrets(data) as Record<string, unknown>,
    };
    try {
      await this.dependencies.events.publish(event);
    } catch {
      // Event gagal ditangani oleh outbox pada layer infrastruktur.
    }
  }
}
