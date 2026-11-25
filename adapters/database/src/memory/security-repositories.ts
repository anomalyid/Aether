/**
 * Implementasi in-memory untuk port Security.
 * Untuk test dan prototype; produksi memakai PostgreSQL (migrations/0002_security.sql).
 *
 * By Anomalyid.
 */

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

class MemoryPolicyRepository implements PolicyRepository {
  private readonly data = new Map<string, Policy>();

  async save(policy: Policy): Promise<void> {
    this.data.set(policy.id, { ...policy });
  }
  async findById(id: string): Promise<Policy | null> {
    return this.data.get(id) ?? null;
  }
  async list(tenantId: string): Promise<Policy[]> {
    return [...this.data.values()].filter(
      (policy) => policy.tenantId === undefined || policy.tenantId === tenantId,
    );
  }
}

class MemoryDelegationRepository implements DelegationRepository {
  private readonly data = new Map<string, Delegation>();

  async save(delegation: Delegation): Promise<void> {
    this.data.set(delegation.id, { ...delegation });
  }
  async findById(id: string): Promise<Delegation | null> {
    return this.data.get(id) ?? null;
  }
  async listByAgent(agentPrincipalId: string, tenantId: string): Promise<Delegation[]> {
    return [...this.data.values()].filter(
      (item) =>
        item.toPrincipalId === agentPrincipalId &&
        item.tenantId === tenantId &&
        item.revokedAt === undefined,
    );
  }
}

class MemoryApprovalRepository implements ApprovalRepository {
  private readonly data = new Map<string, ApprovalRecord>();

  async save(record: ApprovalRecord): Promise<void> {
    this.data.set(record.id, { ...record });
  }
  async findById(id: string): Promise<ApprovalRecord | null> {
    return this.data.get(id) ?? null;
  }
  async listByTenant(tenantId: string): Promise<ApprovalRecord[]> {
    return [...this.data.values()].filter((record) => record.tenantId === tenantId);
  }
}

class MemoryAuditLogRepository implements AuditLogRepository {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push({ ...event });
  }
  async listByTenant(tenantId: string, limit: number): Promise<AuditEvent[]> {
    return this.events
      .filter((event) => event.tenantId === tenantId)
      .slice(-limit)
      .map((event) => ({ ...event }));
  }
}

export interface SecurityRepositories {
  policies: PolicyRepository;
  delegations: DelegationRepository;
  approvals: ApprovalRepository;
  audit: AuditLogRepository;
}

export function createMemorySecurityRepositories(): SecurityRepositories {
  return {
    policies: new MemoryPolicyRepository(),
    delegations: new MemoryDelegationRepository(),
    approvals: new MemoryApprovalRepository(),
    audit: new MemoryAuditLogRepository(),
  };
}
