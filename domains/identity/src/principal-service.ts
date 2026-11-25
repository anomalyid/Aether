/**
 * PrincipalService — identitas eksplisit untuk user, agent, service,
 * integration, dan workload.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";
import { assertTenantMatch } from "./guards.js";
import { createPrincipalId } from "./ids.js";
import type {
  Principal,
  PrincipalId,
  PrincipalType,
  TenantId,
} from "./types.js";
import type { PrincipalRepository, TenantRepository } from "./repositories.js";

export interface EnsurePrincipalInput {
  tenantId?: string;
  principalType: PrincipalType;
  subjectId: string;
}

export class PrincipalService {
  constructor(
    private readonly principals: PrincipalRepository,
    private readonly tenants: TenantRepository,
  ) {}

  async ensure(input: EnsurePrincipalInput): Promise<Principal> {
    const tenantId = input.tenantId === undefined ? undefined : (input.tenantId as TenantId);
    const subjectId = (input.subjectId ?? "").trim();
    if (subjectId.length === 0) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Subject ID tidak boleh kosong.", {
        category: "validation",
        retryable: false,
      });
    }
    if (tenantId !== undefined) {
      const tenant = await this.tenants.findById(tenantId);
      if (tenant === null || tenant.status !== "active") {
        throw new AetherError(ErrorCode.POLICY_BLOCKED, "Tenant tidak tersedia.", {
          category: "authorization",
          retryable: false,
        });
      }
    }

    const existing = await this.principals.findBySubject(tenantId, input.principalType, subjectId);
    if (existing !== null) {
      if (existing.status === "revoked") {
        throw new AetherError(ErrorCode.POLICY_BLOCKED, "Principal telah dicabut.", {
          category: "authorization",
          retryable: false,
        });
      }
      return existing;
    }

    const principal: Principal = {
      id: createPrincipalId(),
      ...(tenantId === undefined ? {} : { tenantId }),
      principalType: input.principalType,
      subjectId,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    await this.principals.save(principal);
    return principal;
  }

  async forUser(userId: string, tenantId: string): Promise<Principal> {
    return this.ensure({
      tenantId,
      principalType: "user",
      subjectId: userId,
    });
  }

  async revoke(id: string): Promise<void> {
    const principal = await this.principals.findById(id as PrincipalId);
    if (principal === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Principal tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    principal.status = "revoked";
    await this.principals.save(principal);
  }

  async assertInTenant(id: string, tenantId: string): Promise<Principal> {
    const principal = await this.principals.findById(id as PrincipalId);
    if (principal === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Principal tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    assertTenantMatch(principal.tenantId, tenantId, "Principal");
    if (principal.status !== "active") {
      throw new AetherError(ErrorCode.AUTHORIZATION_DENIED, "Principal tidak aktif.", {
        category: "authorization",
        retryable: false,
      });
    }
    return principal;
  }
}
