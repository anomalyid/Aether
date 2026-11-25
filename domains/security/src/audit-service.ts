/**
 * Audit Service — catatan aktivitas append-only.
 *
 * Agent yang diaudit tidak boleh mengubah atau menghapus audit record.
 * Port repository sengaja tidak menyediakan update/delete.
 *
 * By Anomalyid.
 */

import { createId } from "@aether/identifiers";
import { redactSecrets } from "@aether/errors";
import type { AuditEvent, AuditOutcome, PrincipalKind } from "./types.js";
import type { AuditLogRepository } from "./ports.js";

export interface RecordAuditInput {
  tenantId: string;
  principalId: string;
  actorType: PrincipalKind;
  action: string;
  resource: string;
  outcome: AuditOutcome;
  correlationId?: string;
  details?: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly audit: AuditLogRepository) {}

  async record(input: RecordAuditInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: createId("audit"),
      tenantId: input.tenantId,
      occurredAt: new Date().toISOString(),
      principalId: input.principalId,
      actorType: input.actorType,
      action: input.action,
      resource: input.resource,
      outcome: input.outcome,
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(input.details === undefined
        ? {}
        : { details: redactSecrets(input.details) as Record<string, unknown> }),
    };
    await this.audit.append(event);
    return event;
  }

  async list(tenantId: string, limit = 100): Promise<AuditEvent[]> {
    return this.audit.listByTenant(tenantId, limit);
  }
}
