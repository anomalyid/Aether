/**
 * Workflow Domain — eksekusi multi-langkah dengan checkpoint dan recovery.
 *
 * State penting disimpan setelah setiap langkah sehingga workflow dapat
 * dilanjutkan setelah restart tanpa mengulang tindakan yang sudah berhasil.
 *
 * By Anomalyid.
 */

import { createId } from "@aether/identifiers";
import { AetherError, ErrorCode, normalizeError, redactSecrets } from "@aether/errors";
import type { EventPublisher } from "@aether/events";

export type WorkflowRunState =
  | "CREATED"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type StepType = "action" | "approval" | "transform";

export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  capabilityId?: string;
  input?: Record<string, unknown>;
  outputKey?: string;
  retry?: { maxAttempts: number; backoffMs: number };
  timeoutMs?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
}

export interface WorkflowDefinition {
  id: string;
  version: string;
  name: string;
  tenantId?: string;
  steps: WorkflowStep[];
  enabled: boolean;
}

export interface WorkflowRun {
  id: string;
  definitionId: string;
  definitionVersion: string;
  tenantId: string;
  principalId: string;
  state: WorkflowRunState;
  context: Record<string, unknown>;
  completedStepIds: string[];
  currentStepId?: string;
  approvalId?: string;
  correlationId?: string;
  error?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDefinitionRepository {
  save(definition: WorkflowDefinition): Promise<void>;
  findById(id: string, version?: string): Promise<WorkflowDefinition | null>;
}

export interface WorkflowRunRepository {
  save(run: WorkflowRun): Promise<void>;
  findById(id: string): Promise<WorkflowRun | null>;
  listByTenant(tenantId: string): Promise<WorkflowRun[]>;
}

export interface StepExecutorPort {
  execute(
    step: WorkflowStep,
    context: Readonly<Record<string, unknown>>,
    meta: { tenantId: string; principalId: string; runId: string },
  ): Promise<unknown>;
}

export interface ApprovalPort {
  create(input: {
    tenantId: string;
    requesterPrincipalId: string;
    agentRunId?: string;
    capabilityId: string;
    resourceReference: string;
    parameters: Record<string, unknown>;
    riskLevel: "low" | "medium" | "high" | "critical";
  }): Promise<{ id: string }>;
  assertApproved(
    id: string,
    tenantId: string,
    capabilityId: string,
    parameters: Record<string, unknown>,
  ): Promise<void>;
}

export interface StartWorkflowInput {
  definitionId: string;
  version?: string;
  tenantId: string;
  principalId: string;
  input: Record<string, unknown>;
  correlationId?: string;
}

export interface WorkflowEngineDependencies {
  definitions: WorkflowDefinitionRepository;
  runs: WorkflowRunRepository;
  executor: StepExecutorPort;
  approvals: ApprovalPort;
  events: EventPublisher;
}

const TERMINAL: readonly WorkflowRunState[] = ["COMPLETED", "FAILED", "CANCELLED"];

export class WorkflowEngine {
  constructor(private readonly dependencies: WorkflowEngineDependencies) {}

  async start(input: StartWorkflowInput): Promise<WorkflowRun> {
    if (input.tenantId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.TENANT_CONTEXT_REQUIRED,
        "Tenant context wajib untuk workflow.",
        { category: "authorization", retryable: false },
      );
    }
    const definition = await this.dependencies.definitions.findById(
      input.definitionId,
      input.version,
    );
    if (definition === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Definisi workflow tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    if (!definition.enabled) {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Workflow tidak aktif.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (definition.tenantId !== undefined && definition.tenantId !== input.tenantId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Workflow tidak tersedia dalam tenant ini.",
        { category: "authorization", retryable: false },
      );
    }

    const now = new Date().toISOString();
    const run: WorkflowRun = {
      id: createId("wf"),
      definitionId: definition.id,
      definitionVersion: definition.version,
      tenantId: input.tenantId,
      principalId: input.principalId,
      state: "CREATED",
      context: redactSecrets(input.input) as Record<string, unknown>,
      completedStepIds: [],
      createdAt: now,
      updatedAt: now,
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
    };
    await this.dependencies.runs.save(run);
    return this.drive(run, definition);
  }

  /** Melanjutkan run setelah restart atau setelah approval. */
  async resume(runId: string, tenantId: string, approvalId?: string): Promise<WorkflowRun> {
    const run = await this.getRun(runId, tenantId);
    // FAILED dapat dilanjutkan sebagai recovery setelah restart.
    if (run.state === "COMPLETED" || run.state === "CANCELLED") {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "Run sudah berada dalam state terminal.", {
        category: "execution",
        retryable: false,
      });
    }
    if (run.state === "WAITING_APPROVAL") {
      if (approvalId === undefined) {
        throw new AetherError(ErrorCode.APPROVAL_REQUIRED, "Approval ID wajib untuk melanjutkan.", {
          category: "authorization",
          retryable: false,
        });
      }
      const step = run.currentStepId === undefined ? undefined : { id: run.currentStepId };
      const parameters = step === undefined ? {} : (run.context[`approval:${step.id}`] ?? {});
      await this.dependencies.approvals.assertApproved(
        approvalId,
        tenantId,
        (run.context[`capability:${run.currentStepId ?? ""}`] as string) ?? "workflow.approval",
        parameters as Record<string, unknown>,
      );
      run.completedStepIds.push(run.currentStepId as string);
      run.approvalId = approvalId;
      await this.dependencies.runs.save(run);
    }

    const definition = await this.dependencies.definitions.findById(
      run.definitionId,
      run.definitionVersion,
    );
    if (definition === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Definisi workflow tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    return this.drive(run, definition);
  }

  async cancel(runId: string, tenantId: string): Promise<WorkflowRun> {
    const run = await this.getRun(runId, tenantId);
    if (TERMINAL.includes(run.state)) {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "Run sudah berada dalam state terminal.", {
        category: "execution",
        retryable: false,
      });
    }
    run.state = "CANCELLED";
    run.updatedAt = new Date().toISOString();
    await this.dependencies.runs.save(run);
    return run;
  }

  private async drive(run: WorkflowRun, definition: WorkflowDefinition): Promise<WorkflowRun> {
    run.state = "RUNNING";
    run.updatedAt = new Date().toISOString();
    await this.dependencies.runs.save(run);

    for (const step of definition.steps) {
      if (run.completedStepIds.includes(step.id)) continue;
      run.currentStepId = step.id;
      await this.dependencies.runs.save(run);

      if (step.type === "approval") {
        const capabilityId = step.capabilityId ?? "workflow.approval";
        const parameters = this.resolveInput(step.input ?? {}, run.context);
        const approval = await this.dependencies.approvals.create({
          tenantId: run.tenantId,
          requesterPrincipalId: run.principalId,
          agentRunId: run.id,
          capabilityId,
          resourceReference: definition.id,
          parameters,
          riskLevel: step.riskLevel ?? "high",
        });
        run.context[`approval:${step.id}`] = redactSecrets(parameters);
        run.context[`capability:${step.id}`] = capabilityId;
        run.approvalId = approval.id;
        run.state = "WAITING_APPROVAL";
        run.updatedAt = new Date().toISOString();
        await this.dependencies.runs.save(run);
        return run;
      }

      const result = await this.executeWithRetry(step, run);
      const resolvedInput = this.resolveInput(step.input ?? {}, run.context);
      run.context[`approval:${step.id}`] = redactSecrets(resolvedInput);
      run.context[`capability:${step.id}`] = step.capabilityId ?? "workflow.transform";
      if (step.outputKey !== undefined) run.context[step.outputKey] = result;

      run.completedStepIds.push(step.id);
      run.updatedAt = new Date().toISOString();
      await this.dependencies.runs.save(run);
      await this.publish(run, "workflow.step.completed", { stepId: step.id });
    }

    run.state = "COMPLETED";
    run.updatedAt = new Date().toISOString();
    await this.dependencies.runs.save(run);
    await this.publish(run, "workflow.completed", {});
    return run;
  }

  private async executeWithRetry(
    step: WorkflowStep,
    run: WorkflowRun,
  ): Promise<unknown> {
    const maxAttempts = step.retry?.maxAttempts ?? 1;
    const backoffMs = step.retry?.backoffMs ?? 0;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.dependencies.executor.execute(
          step,
          run.context,
          {
            tenantId: run.tenantId,
            principalId: run.principalId,
            runId: run.id,
          },
        );
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts && backoffMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    const normalized = normalizeError(lastError, ErrorCode.INTERNAL_ERROR);
    run.state = "FAILED";
    run.error = normalized.toJSON();
    run.updatedAt = new Date().toISOString();
    await this.dependencies.runs.save(run);
    await this.publish(run, "workflow.failed", { stepId: step.id, error: normalized.toJSON() });
    throw normalized;
  }

  private resolveInput(
    input: Record<string, unknown>,
    context: Readonly<Record<string, unknown>>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === "string" && value.startsWith("${{") && value.endsWith("}}")) {
        const path = value.slice(3, -2).trim();
        result[key] = context[path];
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private async getRun(runId: string, tenantId: string): Promise<WorkflowRun> {
    const run = await this.dependencies.runs.findById(runId);
    if (run === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Workflow run tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    if (run.tenantId !== tenantId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Workflow run tidak tersedia dalam tenant ini.",
        { category: "authorization", retryable: false },
      );
    }
    return run;
  }

  private async publish(
    run: WorkflowRun,
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const { createEvent } = await import("@aether/events");
    try {
      await this.dependencies.events.publish(
        createEvent({
          type,
          tenantId: run.tenantId,
          correlationId: run.correlationId,
          source: "workflow.engine",
          data: { runId: run.id, ...redactSecrets(data) },
        }),
      );
    } catch {
      // Event gagal ditangani oleh outbox.
    }
  }
}
