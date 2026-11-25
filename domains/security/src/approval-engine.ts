/**
 * Approval Engine — persetujuan manusia yang terikat pada parameter spesifik.
 *
 * Jika parameter berubah, approval lama tidak dapat dipakai kembali.
 *
 * By Anomalyid.
 */

import { createHash } from "node:crypto";
import { createId } from "@aether/identifiers";
import { AetherError, ErrorCode, redactSecrets } from "@aether/errors";
import type { ApprovalRecord, RiskLevel } from "./types.js";
import type { ApprovalRepository, PermissionProvider } from "./ports.js";

export function parameterDigest(parameters: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(sortDeep(parameters))).digest("hex");
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

export interface CreateApprovalInput {
  tenantId: string;
  requesterPrincipalId: string;
  agentRunId?: string;
  capabilityId: string;
  resourceReference: string;
  parameters: Record<string, unknown>;
  riskLevel: RiskLevel;
  ttlMs?: number;
}

export class ApprovalEngine {
  constructor(
    private readonly approvals: ApprovalRepository,
    private readonly permissions: PermissionProvider,
  ) {}

  async create(input: CreateApprovalInput): Promise<ApprovalRecord> {
    if (input.tenantId.trim().length === 0 || input.capabilityId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.VALIDATION_ERROR,
        "Tenant dan capability wajib disertakan.",
        { category: "validation", retryable: false },
      );
    }

    const ttlMs = input.ttlMs ?? 900_000;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "TTL approval harus positif.", {
        category: "validation",
        retryable: false,
      });
    }

    const now = new Date();
    const record: ApprovalRecord = {
      id: createId("appr"),
      tenantId: input.tenantId,
      requesterPrincipalId: input.requesterPrincipalId,
      ...(input.agentRunId === undefined ? {} : { agentRunId: input.agentRunId }),
      capabilityId: input.capabilityId,
      resourceReference: input.resourceReference,
      parameterDigest: parameterDigest(redactSecrets(input.parameters) as Record<string, unknown>),
      riskLevel: input.riskLevel,
      state: "pending",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };

    await this.approvals.save(record);
    return record;
  }

  async approve(id: string, tenantId: string, approverPrincipalId: string): Promise<ApprovalRecord> {
    const record = await this.get(id, tenantId);
    const granted = await this.permissions.getPermissions(approverPrincipalId, tenantId);
    if (!granted.includes("approval.grant")) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Approver tidak memiliki izin approval.grant.",
        { category: "authorization", retryable: false },
      );
    }
    if (record.state !== "pending") {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "Approval sudah diputuskan.", {
        category: "execution",
        retryable: false,
      });
    }
    if (Date.parse(record.expiresAt) <= Date.now()) {
      record.state = "expired";
      await this.approvals.save(record);
      throw new AetherError(ErrorCode.APPROVAL_REQUIRED, "Approval telah kedaluwarsa.", {
        category: "authorization",
        retryable: false,
      });
    }

    record.state = "approved";
    record.approverPrincipalId = approverPrincipalId;
    record.resolvedAt = new Date().toISOString();
    await this.approvals.save(record);
    return record;
  }

  async reject(id: string, tenantId: string, approverPrincipalId: string): Promise<ApprovalRecord> {
    const record = await this.get(id, tenantId);
    record.state = "rejected";
    record.approverPrincipalId = approverPrincipalId;
    record.resolvedAt = new Date().toISOString();
    await this.approvals.save(record);
    return record;
  }

  async assertApproved(
    id: string,
    tenantId: string,
    capabilityId: string,
    parameters: Record<string, unknown>,
  ): Promise<void> {
    const record = await this.get(id, tenantId);
    if (record.state === "expired" || Date.parse(record.expiresAt) <= Date.now()) {
      throw new AetherError(ErrorCode.APPROVAL_REQUIRED, "Approval tidak berlaku lagi.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (record.state !== "approved") {
      throw new AetherError(ErrorCode.APPROVAL_REQUIRED, "Approval belum diberikan.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (record.capabilityId !== capabilityId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Approval tidak cocok dengan capability ini.",
        { category: "authorization", retryable: false },
      );
    }
    const digest = parameterDigest(redactSecrets(parameters) as Record<string, unknown>);
    if (record.parameterDigest !== digest) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Parameter berubah setelah approval diberikan.",
        { category: "authorization", retryable: false },
      );
    }
  }

  async get(id: string, tenantId: string): Promise<ApprovalRecord> {
    const record = await this.approvals.findById(id);
    if (record === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Approval tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    if (record.tenantId !== tenantId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Approval tidak tersedia dalam tenant ini.",
        { category: "authorization", retryable: false },
      );
    }
    return record;
  }
}
