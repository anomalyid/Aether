/**
 * Tipe domain Security Aether.
 *
 * By Anomalyid.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Decision = "allow" | "deny" | "require_approval";
export type PrincipalKind = "user" | "agent" | "service" | "integration" | "workload";

export interface PrincipalContext {
  tenantId: string;
  principalId: string;
  actorType: PrincipalKind;
}

export interface AuthorizationRequest {
  principal: PrincipalContext;
  action: string;
  resource: string;
  capability?: string;
  riskLevel?: RiskLevel;
  attributes?: Record<string, string | number | boolean>;
}

export interface PolicyDecision {
  decision: Decision;
  policyIds: string[];
  reasonCode: string;
  obligations: string[];
  expiresAt?: string;
}

export interface PolicyCondition {
  attribute: string;
  operator: "eq" | "neq" | "in" | "gt" | "lt";
  value: string | number | boolean | string[];
}

export interface Policy {
  id: string;
  tenantId?: string;
  effect: Decision;
  actions: string[];
  capabilities?: string[];
  resources?: string[];
  conditions?: PolicyCondition[];
  priority: number;
  enabled: boolean;
  expiresAt?: string;
  description?: string;
}

export interface Delegation {
  id: string;
  tenantId: string;
  fromPrincipalId: string;
  toPrincipalId: string;
  permissions: string[];
  capabilityScope?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export type ApprovalState = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRecord {
  id: string;
  tenantId: string;
  requesterPrincipalId: string;
  agentRunId?: string;
  capabilityId: string;
  resourceReference: string;
  parameterDigest: string;
  riskLevel: RiskLevel;
  state: ApprovalState;
  approverPrincipalId?: string;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
}

export type AuditOutcome = "allowed" | "denied" | "executed" | "failed" | "approval";

export interface AuditEvent {
  id: string;
  tenantId: string;
  occurredAt: string;
  principalId: string;
  actorType: PrincipalKind;
  action: string;
  resource: string;
  outcome: AuditOutcome;
  correlationId?: string;
  details?: Record<string, unknown>;
}
