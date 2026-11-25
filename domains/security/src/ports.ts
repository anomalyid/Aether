/**
 * Port yang harus diimplementasikan oleh adapter/domain lain.
 *
 * By Anomalyid.
 */

import type {
  ApprovalRecord,
  AuditEvent,
  Delegation,
  Policy,
} from "./types.js";

export interface PermissionProvider {
  getPermissions(principalId: string, tenantId: string): Promise<string[]>;
}

export interface PolicyRepository {
  save(policy: Policy): Promise<void>;
  findById(id: string): Promise<Policy | null>;
  list(tenantId: string): Promise<Policy[]>;
}

export interface DelegationRepository {
  save(delegation: Delegation): Promise<void>;
  findById(id: string): Promise<Delegation | null>;
  listByAgent(agentPrincipalId: string, tenantId: string): Promise<Delegation[]>;
}

export interface ApprovalRepository {
  save(record: ApprovalRecord): Promise<void>;
  findById(id: string): Promise<ApprovalRecord | null>;
  listByTenant(tenantId: string): Promise<ApprovalRecord[]>;
}

/** Audit bersifat append-only: tidak ada method update atau delete. */
export interface AuditLogRepository {
  append(event: AuditEvent): Promise<void>;
  listByTenant(tenantId: string, limit: number): Promise<AuditEvent[]>;
}
