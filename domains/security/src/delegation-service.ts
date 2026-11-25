/**
 * Delegation Service — rantai izin user → agent → capability.
 *
 * Agent tidak boleh memperluas izin yang didelegasikan kepadanya.
 * Delegasi memiliki expiry dan dapat dicabut.
 *
 * By Anomalyid.
 */

import { createId } from "@aether/identifiers";
import { AetherError, ErrorCode, redactSecrets } from "@aether/errors";
import type { Delegation } from "./types.js";
import type { DelegationRepository, PermissionProvider } from "./ports.js";

export interface CreateDelegationInput {
  tenantId: string;
  fromPrincipalId: string;
  toPrincipalId: string;
  permissions: string[];
  capabilityScope?: string;
  ttlMs?: number;
}

export class DelegationService {
  constructor(
    private readonly permissions: PermissionProvider,
    private readonly delegations: DelegationRepository,
  ) {}

  async create(input: CreateDelegationInput): Promise<Delegation> {
    if (input.tenantId.trim().length === 0) {
      throw new AetherError(
        ErrorCode.TENANT_CONTEXT_REQUIRED,
        "Tenant context wajib untuk delegasi.",
        { category: "authorization", retryable: false },
      );
    }
    if (input.fromPrincipalId === input.toPrincipalId) {
      throw new AetherError(
        ErrorCode.VALIDATION_ERROR,
        "Principal sumber dan tujuan delegasi tidak boleh sama.",
        { category: "validation", retryable: false },
      );
    }
    if (input.permissions.length === 0) {
      throw new AetherError(
        ErrorCode.VALIDATION_ERROR,
        "Delegasi harus memiliki minimal satu permission.",
        { category: "validation", retryable: false },
      );
    }

    const ttlMs = input.ttlMs ?? 3_600_000;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "TTL delegasi harus positif.", {
        category: "validation",
        retryable: false,
      });
    }

    const sourcePermissions = await this.permissions.getPermissions(
      input.fromPrincipalId,
      input.tenantId,
    );
    const expanded = input.permissions.filter((permission) => !sourcePermissions.includes(permission));
    if (expanded.length > 0) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Agent tidak boleh memperluas izin yang didelegasikan.",
        {
          category: "authorization",
          retryable: false,
          details: { expanded: redactSecrets(expanded) },
        },
      );
    }

    const now = new Date();
    const delegation: Delegation = {
      id: createId("del"),
      tenantId: input.tenantId,
      fromPrincipalId: input.fromPrincipalId,
      toPrincipalId: input.toPrincipalId,
      permissions: [...new Set(input.permissions)],
      ...(input.capabilityScope === undefined ? {} : { capabilityScope: input.capabilityScope }),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };

    await this.delegations.save(delegation);
    return delegation;
  }

  async revoke(id: string, tenantId: string): Promise<void> {
    const delegation = await this.get(id, tenantId);
    delegation.revokedAt = new Date().toISOString();
    await this.delegations.save(delegation);
  }

  async assertValid(id: string, tenantId: string, capability?: string): Promise<Delegation> {
    const delegation = await this.get(id, tenantId);
    if (delegation.revokedAt !== undefined) {
      throw new AetherError(ErrorCode.AUTHORIZATION_DENIED, "Delegasi telah dicabut.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (Date.parse(delegation.expiresAt) <= Date.now()) {
      throw new AetherError(ErrorCode.AUTHORIZATION_DENIED, "Delegasi telah kedaluwarsa.", {
        category: "authorization",
        retryable: false,
      });
    }
    if (
      capability !== undefined &&
      delegation.capabilityScope !== undefined &&
      delegation.capabilityScope !== capability
    ) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Capability di luar scope delegasi.",
        { category: "authorization", retryable: false },
      );
    }
    return delegation;
  }

  async effectivePermissions(id: string, tenantId: string): Promise<string[]> {
    const delegation = await this.assertValid(id, tenantId);
    return [...delegation.permissions];
  }

  private async get(id: string, tenantId: string): Promise<Delegation> {
    const delegation = await this.delegations.findById(id);
    if (delegation === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Delegasi tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    if (delegation.tenantId !== tenantId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Delegasi tidak tersedia dalam tenant ini.",
        { category: "authorization", retryable: false },
      );
    }
    return delegation;
  }
}
