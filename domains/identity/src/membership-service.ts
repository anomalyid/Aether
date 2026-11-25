/**
 * MembershipService — hubungan user dengan tenant dan role.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";
import { assertTenantMatch } from "./guards.js";
import { createMembershipId } from "./ids.js";
import type {
  Membership,
  RoleId,
  TenantId,
  UserId,
} from "./types.js";
import type {
  MembershipRepository,
  RoleRepository,
  TenantRepository,
  UserRepository,
} from "./repositories.js";

export interface AddMemberInput {
  tenantId: string;
  userId: string;
  roleId: string;
}

export class MembershipService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly tenants: TenantRepository,
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
  ) {}

  async addMember(input: AddMemberInput): Promise<Membership> {
    const tenantId = input.tenantId as TenantId;
    const userId = input.userId as UserId;
    const roleId = input.roleId as RoleId;

    const tenant = await this.tenants.findById(tenantId);
    if (tenant === null || tenant.status !== "active") {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Tenant tidak tersedia.", {
        category: "authorization",
        retryable: false,
      });
    }

    const user = await this.users.findById(userId);
    if (user === null || user.status !== "active") {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "User tidak tersedia.", {
        category: "authorization",
        retryable: false,
      });
    }

    const role = await this.roles.findById(roleId);
    if (role === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Role tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    assertTenantMatch(role.tenantId, tenantId, "Role");

    const existing = await this.memberships.findByUserAndRole(userId, roleId);
    if (existing !== null && existing.status === "active") {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "User sudah memiliki role tersebut.", {
        category: "execution",
        retryable: false,
      });
    }

    const membership: Membership = {
      id: createMembershipId(),
      tenantId,
      userId,
      roleId,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    await this.memberships.save(membership);
    return membership;
  }

  async removeMember(tenantId: string, userId: string): Promise<void> {
    const memberships = await this.memberships.listByUser(userId as UserId);
    for (const membership of memberships) {
      if (membership.tenantId === tenantId && membership.status === "active") {
        membership.status = "removed";
        await this.memberships.save(membership);
      }
    }
  }

  async listByTenant(tenantId: string): Promise<Membership[]> {
    return (await this.memberships.listByTenant(tenantId as TenantId)).filter(
      (membership) => membership.status === "active",
    );
  }

  async getPermissions(userId: string, tenantId: string): Promise<string[]> {
    const memberships = await this.memberships.listByUser(userId as UserId);
    const permissions = new Set<string>();

    for (const membership of memberships) {
      if (membership.status !== "active" || membership.tenantId !== tenantId) continue;
      const rolePermissions = await this.roles.listPermissions(membership.roleId);
      for (const permission of rolePermissions) permissions.add(permission.key);
    }

    return [...permissions].sort();
  }

  async hasRole(userId: string, tenantId: string, roleName: string): Promise<boolean> {
    const memberships = await this.memberships.listByUser(userId as UserId);
    for (const membership of memberships) {
      if (membership.status !== "active" || membership.tenantId !== tenantId) continue;
      const role = await this.roles.findById(membership.roleId);
      if (role?.name === roleName) return true;
    }
    return false;
  }
}
