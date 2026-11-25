/**
 * Agent Runtime — siklus hidup execution agent.
 *
 * State transition dikontrol runtime, bukan diputuskan model.
 * Setiap tool call melewati Capability Engine.
 *
 * By Anomalyid.
 */

import { createId } from "@aether/identifiers";
import { AetherError, ErrorCode, normalizeError, redactSecrets } from "@aether/errors";
import type {
  AuditPort,
  DomainEvent,
  EventPublisherPort,
  InvocationResult,
} from "@aether/capabilities";
import type {
  AgentDefinition,
  AgentRun,
  AgentRunState,
  CapabilityInvokerPort,
  ContextItem,
  ModelToolDescriptor,
} from "./types.js";
import type {
  AgentDefinitionRepository,
  AgentRunRepository,
} from "./ports.js";
import { ContextEngine } from "./context-engine.js";
import { ModelGateway } from "./model-gateway.js";

const TRANSITIONS: Record<AgentRunState, readonly AgentRunState[]> = {
  CREATED: ["VALIDATING", "CANCELLED"],
  VALIDATING: ["QUEUED", "FAILED", "CANCELLED"],
  QUEUED: ["RUNNING", "CANCELLED", "EXPIRED"],
  RUNNING: ["WAITING_TOOL", "WAITING_APPROVAL", "COMPLETED", "FAILED", "CANCELLED"],
  WAITING_TOOL: ["RUNNING", "WAITING_APPROVAL", "FAILED", "CANCELLED"],
  WAITING_APPROVAL: ["RESUMING", "EXPIRED", "CANCELLED"],
  RESUMING: ["RUNNING", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export interface StartRunInput {
  agentId: string;
  version?: string;
  tenantId: string;
  principalId: string;
  input: Record<string, unknown>;
  correlationId?: string;
  delegationId?: string;
}

export interface RuntimeDependencies {
  definitions: AgentDefinitionRepository;
  runs: AgentRunRepository;
  models: ModelGateway;
  context: ContextEngine;
  capabilities: CapabilityInvokerPort;
  audit: AuditPort;
  events: EventPublisherPort;
}

export class AgentRuntime {
  constructor(private readonly dependencies: RuntimeDependencies) {}

  async start(input: StartRunInput): Promise<AgentRun> {
    if (input.tenantId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.TENANT_CONTEXT_REQUIRED,
        "Tenant context wajib untuk menjalankan agent.",
        { category: "authorization", retryable: false },
      );
    }

    const definition = await this.dependencies.definitions.findById(
      input.agentId,
      input.version,
    );
    if (definition === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Definisi agent tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    if (!definition.enabled) {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Agent tidak aktif.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (definition.tenantId !== undefined && definition.tenantId !== input.tenantId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Agent tidak tersedia dalam tenant ini.",
        { category: "authorization", retryable: false },
      );
    }

    const now = new Date().toISOString();
    const run: AgentRun = {
      id: createId("run"),
      agentId: definition.id,
      agentVersion: definition.version,
      tenantId: input.tenantId,
      principalId: input.principalId,
      state: "CREATED",
      input: redactSecrets(input.input) as Record<string, unknown>,
      steps: 0,
      modelCalls: 0,
      toolCalls: 0,
      createdAt: now,
      updatedAt: now,
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
    };

    this.transition(run, "VALIDATING");
    this.transition(run, "QUEUED");
    await this.dependencies.runs.save(run);
    await this.publish(run, "agent.run.created");

    return this.drive(run, definition, input.input, []);
  }

  async resume(runId: string, tenantId: string, approvalId: string): Promise<AgentRun> {
    const run = await this.getRun(runId, tenantId);
    if (run.state !== "WAITING_APPROVAL") {
      throw new AetherError(
        ErrorCode.RESOURCE_CONFLICT,
        "Hanya run yang menunggu approval yang dapat dilanjutkan.",
        { category: "execution", retryable: false },
      );
    }
    const definition = await this.dependencies.definitions.findById(run.agentId, run.agentVersion);
    if (definition === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Definisi agent tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }

    run.approvalId = approvalId;
    this.transition(run, "RESUMING");
    await this.dependencies.runs.save(run);
    return this.drive(run, definition, run.input, [], approvalId);
  }

  async cancel(runId: string, tenantId: string): Promise<AgentRun> {
    const run = await this.getRun(runId, tenantId);
    if (["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(run.state)) {
      throw new AetherError(
        ErrorCode.RESOURCE_CONFLICT,
        "Run sudah berada dalam state terminal.",
        { category: "execution", retryable: false },
      );
    }
    this.transition(run, "CANCELLED");
    await this.dependencies.runs.save(run);
    await this.dependencies.audit.record({
      tenantId,
      principalId: run.principalId,
      actorType: "agent",
      action: "agent.run.cancel",
      resource: run.id,
      outcome: "failed",
      details: { previousState: run.state },
    });
    await this.publish(run, "agent.run.cancelled");
    return run;
  }

  private async drive(
    run: AgentRun,
    definition: AgentDefinition,
    userInput: Record<string, unknown>,
    toolResults: ContextItem[],
    approvalId?: string,
  ): Promise<AgentRun> {
    const startedAt = Date.now();
    this.transition(run, "RUNNING");
    await this.dependencies.runs.save(run);

    try {
      const tools: ModelToolDescriptor[] = definition.capabilities.allowed.map((name) => ({
        name,
        description: `Capability ${name} yang diizinkan untuk agent ${definition.id}.`,
        inputSchema: { type: "object" },
      }));

      while (run.steps < definition.limits.maxSteps) {
        if (Date.now() - startedAt > definition.limits.maxDurationMs) {
          throw new AetherError(ErrorCode.EXECUTION_TIMEOUT, "Budget waktu agent habis.", {
            category: "execution",
            retryable: false,
          });
        }
        if (run.modelCalls >= definition.limits.maxModelCalls) {
          throw new AetherError(ErrorCode.POLICY_BLOCKED, "Budget panggilan model habis.", {
            category: "authorization",
            retryable: false,
          });
        }

        const items = this.dependencies.context.build({
          instructions: definition.instructions,
          userInput,
          toolResults,
        });
        const generated = await this.dependencies.models.generate(
          {
            messages: this.dependencies.context.toModelMessages(items),
            ...(tools.length > 0 ? { tools } : {}),
          },
          {
            preferredProvider: definition.model.provider,
            allowFallback: true,
            budget: definition.limits,
          },
        );

        run.steps += 1;
        run.modelCalls += 1;
        await this.dependencies.runs.save(run);

        if (generated.response.toolCalls === undefined || generated.response.toolCalls.length === 0) {
          run.output = generated.response.text;
          this.transition(run, "COMPLETED");
          await this.dependencies.runs.save(run);
          await this.dependencies.audit.record({
            tenantId: run.tenantId,
            principalId: run.principalId,
            actorType: "agent",
            action: "agent.run.complete",
            resource: run.id,
            outcome: "executed",
            details: {
              agentVersion: run.agentVersion,
              provider: generated.providerId,
              fallbackUsed: generated.fallbackUsed,
            },
          });
          await this.publish(run, "agent.run.completed");
          return run;
        }

        for (const call of generated.response.toolCalls) {
          if (!definition.capabilities.allowed.includes(call.name)) {
            throw new AetherError(
              ErrorCode.POLICY_BLOCKED,
              `Agent mencoba capability di luar daftar izin: ${call.name}.`,
              { category: "authorization", retryable: false },
            );
          }
          if (run.toolCalls >= definition.limits.maxToolCalls) {
            throw new AetherError(ErrorCode.POLICY_BLOCKED, "Budget panggilan tool habis.", {
              category: "authorization",
              retryable: false,
            });
          }

          this.transition(run, "WAITING_TOOL");
          run.toolCalls += 1;
          await this.dependencies.runs.save(run);

          const result: InvocationResult = await this.dependencies.capabilities.invoke({
            capabilityId: call.name,
            input: call.arguments,
            principal: {
              tenantId: run.tenantId,
              principalId: run.principalId,
              actorType: "agent",
            },
            tenantId: run.tenantId,
            agentRunId: run.id,
            correlationId: run.correlationId,
            ...(approvalId === undefined ? {} : { approvalId }),
            idempotencyKey: call.callId,
          });

          if (result.status === "awaiting_approval") {
            run.approvalId = result.approvalId;
            this.transition(run, "WAITING_APPROVAL");
            await this.dependencies.runs.save(run);
            await this.dependencies.audit.record({
              tenantId: run.tenantId,
              principalId: run.principalId,
              actorType: "agent",
              action: "agent.run.approval",
              resource: run.id,
              outcome: "approval",
              details: { capabilityId: call.name, approvalId: result.approvalId },
            });
            await this.publish(run, "agent.run.waiting_approval");
            return run;
          }

          toolResults.push({
            id: createId("ctx"),
            type: "tool_result",
            content: result.output ?? { error: result.error },
            source: call.name,
            trust: "untrusted",
            createdAt: new Date().toISOString(),
          });

          this.transition(run, "RUNNING");
          await this.dependencies.runs.save(run);
        }
      }

      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Budget langkah agent habis.", {
        category: "authorization",
        retryable: false,
      });
    } catch (error) {
      const normalized = normalizeError(error, ErrorCode.INTERNAL_ERROR);
      run.error = normalized.toJSON();
      if (TRANSITIONS[run.state].includes("FAILED")) this.transition(run, "FAILED");
      await this.dependencies.runs.save(run);
      await this.dependencies.audit.record({
        tenantId: run.tenantId,
        principalId: run.principalId,
        actorType: "agent",
        action: "agent.run.fail",
        resource: run.id,
        outcome: "failed",
        details: { code: normalized.code, message: normalized.message },
      });
      await this.publish(run, "agent.run.failed");
      return run;
    }
  }

  private async getRun(runId: string, tenantId: string): Promise<AgentRun> {
    const run = await this.dependencies.runs.findById(runId);
    if (run === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Agent run tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    if (run.tenantId !== tenantId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Agent run tidak tersedia dalam tenant ini.",
        { category: "authorization", retryable: false },
      );
    }
    return run;
  }

  private transition(run: AgentRun, next: AgentRunState): void {
    if (!TRANSITIONS[run.state].includes(next)) {
      throw new AetherError(
        ErrorCode.KERNEL_LIFECYCLE_INVALID,
        `Transisi agent run ${run.state} → ${next} tidak diizinkan.`,
        { category: "execution", retryable: false, details: { runId: run.id } },
      );
    }
    run.state = next;
    run.updatedAt = new Date().toISOString();
  }

  private async publish(run: AgentRun, type: string): Promise<void> {
    const event: DomainEvent = {
      id: createId("evt"),
      type,
      version: 1,
      tenantId: run.tenantId,
      occurredAt: new Date().toISOString(),
      ...(run.correlationId === undefined ? {} : { correlationId: run.correlationId }),
      source: "agent.runtime",
      data: {
        runId: run.id,
        agentId: run.agentId,
        agentVersion: run.agentVersion,
        state: run.state,
      },
    };
    try {
      await this.dependencies.events.publish(event);
    } catch {
      // Event gagal ditangani oleh outbox.
    }
  }
}
