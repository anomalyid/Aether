/**
 * Tipe domain Capability Aether.
 *
 * By Anomalyid.
 */

import type { RiskLevel, PrincipalContext, PolicyDecision } from "@aether/security";
import type { JsonSchema } from "./schema-validator.js";

export type { JsonSchema } from "./schema-validator.js";

export type IdempotencyMode = "required" | "supported" | "unsupported";

export interface CapabilityDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  riskLevel: RiskLevel;
  permissions: string[];
  idempotency: IdempotencyMode;
  timeoutMs: number;
  owner: string;
  provider: string;
  tenantId?: string;
  enabled: boolean;
  deprecated?: boolean;
}

export interface InvocationRequest {
  capabilityId: string;
  version?: string;
  input: Record<string, unknown>;
  principal: PrincipalContext;
  tenantId: string;
  idempotencyKey?: string;
  approvalId?: string;
  agentRunId?: string;
  correlationId?: string;
}

export type InvocationStatus =
  | "completed"
  | "failed"
  | "awaiting_approval"
  | "cancelled";

export interface InvocationResult {
  invocationId: string;
  capabilityId: string;
  status: InvocationStatus;
  output?: unknown;
  error?: { code: string; message: string };
  approvalId?: string;
  auditId?: string;
  replayed?: boolean;
}

export interface InvocationContext {
  invocationId: string;
  tenantId: string;
  principalId: string;
  correlationId?: string;
  agentRunId?: string;
}

export interface ProviderExecutor {
  execute(
    capabilityId: string,
    input: Readonly<Record<string, unknown>>,
    context: InvocationContext,
  ): Promise<unknown>;
}

export interface DomainEvent {
  id: string;
  type: string;
  version: number;
  tenantId: string;
  occurredAt: string;
  correlationId?: string;
  source: string;
  data: Record<string, unknown>;
}

export interface PolicyEvaluatorPort {
  evaluate(request: {
    principal: PrincipalContext;
    action: string;
    resource: string;
    capability: string;
    riskLevel: RiskLevel;
    attributes?: Record<string, string | number | boolean>;
  }): Promise<PolicyDecision>;
}

export interface ApprovalPort {
  create(input: {
    tenantId: string;
    requesterPrincipalId: string;
    agentRunId?: string;
    capabilityId: string;
    resourceReference: string;
    parameters: Record<string, unknown>;
    riskLevel: RiskLevel;
  }): Promise<{ id: string }>;
  assertApproved(
    id: string,
    tenantId: string,
    capabilityId: string,
    parameters: Record<string, unknown>,
  ): Promise<void>;
}

export interface AuditPort {
  record(input: {
    tenantId: string;
    principalId: string;
    actorType: PrincipalContext["actorType"];
    action: string;
    resource: string;
    outcome: "allowed" | "denied" | "executed" | "failed" | "approval";
    correlationId?: string;
    details?: Record<string, unknown>;
  }): Promise<{ id: string }>;
}

export interface EventPublisherPort {
  publish(event: DomainEvent): Promise<void>;
}

export interface IdempotencyRecord {
  key: string;
  tenantId: string;
  inputDigest: string;
  result: InvocationResult;
  createdAt: string;
}

export interface IdempotencyStore {
  find(key: string, tenantId: string): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}
