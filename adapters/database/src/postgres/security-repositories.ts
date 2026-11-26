/**
 * Repository Security berbasis PostgreSQL dengan tenant context.
 *
 * By Anomalyid.
 */

import type { Pool, PoolClient } from "pg";
import type {
  ApprovalRecord,
  ApprovalRepository,
  AuditEvent,
  AuditLogRepository,
  Delegation,
  DelegationRepository,
  Policy,
  PolicyRepository,
} from "@aether/security";

export interface SecurityRepositories {
  policies: PolicyRepository;
  delegations: DelegationRepository;
  approvals: ApprovalRepository;
  audit: AuditLogRepository;
}
import { PgTenantRunner } from "./identity-repositories.js";

type Row = Record<string, unknown>;
const str = (row: Row, key: string): string => String(row[key]);
const optional = (row: Row, key: string): string | undefined => {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
};
const list = (row: Row, key: string): string[] =>
  Array.isArray(row[key]) ? row[key].map((item) => String(item)) : [];
const timestamp = (row: Row, key: string): string => {
  const value = row[key];
  return value instanceof Date ? value.toISOString() : String(value);
};

function mapPolicy(row: Row): Policy {
  const policy: Policy = {
    id: str(row, "id"),
    effect: str(row, "effect") as Policy["effect"],
    actions: list(row, "actions"),
    priority: Number(row.priority),
    enabled: row.enabled === true,
  };
  if (optional(row, "tenant_id") !== undefined) policy.tenantId = optional(row, "tenant_id");
  if (list(row, "capabilities").length > 0) policy.capabilities = list(row, "capabilities");
  if (list(row, "resources").length > 0) policy.resources = list(row, "resources");
  if (Array.isArray(row.conditions)) {
    policy.conditions = row.conditions as Policy["conditions"];
  }
  if (optional(row, "expires_at") !== undefined) policy.expiresAt = optional(row, "expires_at");
  if (optional(row, "description") !== undefined) policy.description = optional(row, "description");
  return policy;
}

function mapDelegation(row: Row): Delegation {
  const delegation: Delegation = {
    id: str(row, "id"),
    tenantId: str(row, "tenant_id"),
    fromPrincipalId: str(row, "from_principal_id"),
    toPrincipalId: str(row, "to_principal_id"),
    permissions: list(row, "permissions"),
    createdAt: timestamp(row, "created_at"),
    expiresAt: timestamp(row, "expires_at"),
  };
  if (optional(row, "capability_scope") !== undefined) delegation.capabilityScope = optional(row, "capability_scope");
  if (optional(row, "revoked_at") !== undefined) delegation.revokedAt = optional(row, "revoked_at");
  return delegation;
}

function mapApproval(row: Row): ApprovalRecord {
  const record: ApprovalRecord = {
    id: str(row, "id"),
    tenantId: str(row, "tenant_id"),
    requesterPrincipalId: str(row, "requester_principal_id"),
    capabilityId: str(row, "capability_id"),
    resourceReference: str(row, "resource_reference"),
    parameterDigest: str(row, "parameter_digest"),
    riskLevel: str(row, "risk_level") as ApprovalRecord["riskLevel"],
    state: str(row, "state") as ApprovalRecord["state"],
    createdAt: timestamp(row, "created_at"),
    expiresAt: timestamp(row, "expires_at"),
  };
  if (optional(row, "agent_run_id") !== undefined) record.agentRunId = optional(row, "agent_run_id");
  if (optional(row, "approver_principal_id") !== undefined) record.approverPrincipalId = optional(row, "approver_principal_id");
  if (optional(row, "resolved_at") !== undefined) record.resolvedAt = optional(row, "resolved_at");
  return record;
}

function mapAudit(row: Row): AuditEvent {
  const event: AuditEvent = {
    id: str(row, "id"),
    tenantId: str(row, "tenant_id"),
    occurredAt: timestamp(row, "occurred_at"),
    principalId: str(row, "principal_id"),
    actorType: str(row, "actor_type") as AuditEvent["actorType"],
    action: str(row, "action"),
    resource: str(row, "resource"),
    outcome: str(row, "outcome") as AuditEvent["outcome"],
  };
  if (optional(row, "correlation_id") !== undefined) event.correlationId = optional(row, "correlation_id");
  if (row.details !== null && row.details !== undefined) event.details = row.details as Record<string, unknown>;
  return event;
}

class PgPolicyRepository implements PolicyRepository {
  constructor(private readonly runner: PgTenantRunner) {}

  async save(policy: Policy): Promise<void> {
    await this.runner.run(policy.tenantId, (client: PoolClient) =>
      client.query(
        `INSERT INTO policies (id, tenant_id, effect, actions, capabilities, resources,
           conditions, priority, enabled, expires_at, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET effect=EXCLUDED.effect, actions=EXCLUDED.actions,
           capabilities=EXCLUDED.capabilities, resources=EXCLUDED.resources,
           conditions=EXCLUDED.conditions, priority=EXCLUDED.priority,
           enabled=EXCLUDED.enabled, expires_at=EXCLUDED.expires_at,
           description=EXCLUDED.description`,
        [
          policy.id,
          policy.tenantId ?? null,
          policy.effect,
          policy.actions,
          policy.capabilities ?? [],
          policy.resources ?? [],
          JSON.stringify(policy.conditions ?? {}),
          policy.priority,
          policy.enabled,
          policy.expiresAt ?? null,
          policy.description ?? null,
        ],
      ),
    );
  }

  async findById(id: string): Promise<Policy | null> {
    const result = await this.runner.global((client) => client.query("SELECT * FROM policies WHERE id = $1", [id]));
    const row = result.rows[0];
    return row === undefined ? null : mapPolicy(row as Row);
  }

  async list(tenantId: string): Promise<Policy[]> {
    const result = await this.runner.run(tenantId, (client: PoolClient) =>
      client.query("SELECT * FROM policies WHERE tenant_id IS NULL OR tenant_id = $1", [tenantId]),
    );
    return result.rows.map((row) => mapPolicy(row as Row));
  }
}

class PgDelegationRepository implements DelegationRepository {
  constructor(
    private readonly runner: PgTenantRunner,
    private readonly tenantId: string,
  ) {}

  async save(delegation: Delegation): Promise<void> {
    await this.runner.run(this.tenantId, (client: PoolClient) =>
      client.query(
        `INSERT INTO delegations (id, tenant_id, from_principal_id, to_principal_id,
           permissions, capability_scope, created_at, expires_at, revoked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET revoked_at=EXCLUDED.revoked_at`,
        [
          delegation.id,
          delegation.tenantId,
          delegation.fromPrincipalId,
          delegation.toPrincipalId,
          delegation.permissions,
          delegation.capabilityScope ?? null,
          delegation.createdAt,
          delegation.expiresAt,
          delegation.revokedAt ?? null,
        ],
      ),
    );
  }

  async findById(id: string): Promise<Delegation | null> {
    const result = await this.runner.run(this.tenantId, (client) =>
      client.query("SELECT * FROM delegations WHERE id = $1", [id]),
    );
    const row = result.rows[0];
    return row === undefined ? null : mapDelegation(row as Row);
  }

  async listByAgent(agentPrincipalId: string, tenantId: string): Promise<Delegation[]> {
    const result = await this.runner.run(tenantId, (client) =>
      client.query(
        "SELECT * FROM delegations WHERE to_principal_id = $1 AND tenant_id = $2 AND revoked_at IS NULL",
        [agentPrincipalId, tenantId],
      ),
    );
    return result.rows.map((row) => mapDelegation(row as Row));
  }
}

class PgApprovalRepository implements ApprovalRepository {
  constructor(
    private readonly runner: PgTenantRunner,
    private readonly tenantId: string,
  ) {}

  async save(record: ApprovalRecord): Promise<void> {
    await this.runner.run(this.tenantId, (client: PoolClient) =>
      client.query(
        `INSERT INTO approvals (id, tenant_id, requester_principal_id, agent_run_id,
           capability_id, resource_reference, parameter_digest, risk_level, state,
           approver_principal_id, created_at, expires_at, resolved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state,
           approver_principal_id=EXCLUDED.approver_principal_id,
           resolved_at=EXCLUDED.resolved_at`,
        [
          record.id,
          record.tenantId,
          record.requesterPrincipalId,
          record.agentRunId ?? null,
          record.capabilityId,
          record.resourceReference,
          record.parameterDigest,
          record.riskLevel,
          record.state,
          record.approverPrincipalId ?? null,
          record.createdAt,
          record.expiresAt,
          record.resolvedAt ?? null,
        ],
      ),
    );
  }

  async findById(id: string): Promise<ApprovalRecord | null> {
    const result = await this.runner.run(this.tenantId, (client) =>
      client.query("SELECT * FROM approvals WHERE id = $1", [id]),
    );
    const row = result.rows[0];
    return row === undefined ? null : mapApproval(row as Row);
  }

  async listByTenant(tenantId: string): Promise<ApprovalRecord[]> {
    const result = await this.runner.run(tenantId, (client) =>
      client.query("SELECT * FROM approvals WHERE tenant_id = $1", [tenantId]),
    );
    return result.rows.map((row) => mapApproval(row as Row));
  }
}

class PgAuditLogRepository implements AuditLogRepository {
  constructor(private readonly runner: PgTenantRunner) {}

  async append(event: AuditEvent): Promise<void> {
    await this.runner.run(event.tenantId, (client: PoolClient) =>
      client.query(
        `INSERT INTO audit_logs (id, tenant_id, occurred_at, principal_id, actor_type,
           action, resource, outcome, correlation_id, details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          event.id,
          event.tenantId,
          event.occurredAt,
          event.principalId,
          event.actorType,
          event.action,
          event.resource,
          event.outcome,
          event.correlationId ?? null,
          JSON.stringify(event.details ?? {}),
        ],
      ),
    );
  }

  async listByTenant(tenantId: string, limit: number): Promise<AuditEvent[]> {
    const result = await this.runner.run(tenantId, (client) =>
      client.query(
        "SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY occurred_at DESC LIMIT $2",
        [tenantId, limit],
      ),
    );
    return result.rows.map((row) => mapAudit(row as Row));
  }
}

export function createPgSecurityRepositories(pool: Pool, tenantId: string): SecurityRepositories {
  const runner = new PgTenantRunner(pool);
  return {
    policies: new PgPolicyRepository(runner),
    delegations: new PgDelegationRepository(runner, tenantId),
    approvals: new PgApprovalRepository(runner, tenantId),
    audit: new PgAuditLogRepository(runner),
  };
}
