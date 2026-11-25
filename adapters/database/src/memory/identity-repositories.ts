/**
 * Implementasi repository Identity in-memory.
 *
 * Dipakai untuk unit test dan prototype lokal. BUKAN untuk produksi —
 * versi produksi memakai PostgreSQL dengan Row-Level Security
 * (lihat migrations/0001_identity.sql).
 *
 * By Anomalyid.
 */

import type {
  IdentityRepositories,
  Membership,
  MembershipRepository,
  Permission,
  Principal,
  PrincipalId,
  PrincipalRepository,
  PrincipalType,
  Role,
  RoleId,
  RolePermission,
  RoleRepository,
  Tenant,
  TenantId,
  TenantRepository,
  User,
  UserId,
  UserRepository,
} from "@aether/identity";

class MemoryTenantRepository implements TenantRepository {
  private readonly data = new Map<string, Tenant>();

  async save(tenant: Tenant): Promise<void> {
    this.data.set(tenant.id, { ...tenant });
  }
  async findById(id: TenantId): Promise<Tenant | null> {
    return this.data.get(id) ?? null;
  }
  async findBySlug(slug: string): Promise<Tenant | null> {
    for (const tenant of this.data.values()) if (tenant.slug === slug) return tenant;
    return null;
  }
  async list(): Promise<Tenant[]> {
    return [...this.data.values()];
  }
}

class MemoryUserRepository implements UserRepository {
  private readonly data = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.data.set(user.id, { ...user });
  }
  async findById(id: UserId): Promise<User | null> {
    return this.data.get(id) ?? null;
  }
  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.data.values()) if (user.email === email) return user;
    return null;
  }
  async list(): Promise<User[]> {
    return [...this.data.values()];
  }
}

class MemoryMembershipRepository implements MembershipRepository {
  private readonly data = new Map<string, Membership>();

  async save(membership: Membership): Promise<void> {
    this.data.set(membership.id, { ...membership });
  }
  async findById(id: string): Promise<Membership | null> {
    return this.data.get(id) ?? null;
  }
  async findByUserAndRole(userId: UserId, roleId: RoleId): Promise<Membership | null> {
    for (const membership of this.data.values()) {
      if (membership.userId === userId && membership.roleId === roleId) return membership;
    }
    return null;
  }
  async listByTenant(tenantId: TenantId): Promise<Membership[]> {
    return [...this.data.values()].filter((item) => item.tenantId === tenantId);
  }
  async listByUser(userId: UserId): Promise<Membership[]> {
    return [...this.data.values()].filter((item) => item.userId === userId);
  }
}

class MemoryPrincipalRepository implements PrincipalRepository {
  private readonly data = new Map<string, Principal>();

  async save(principal: Principal): Promise<void> {
    this.data.set(principal.id, { ...principal });
  }
  async findById(id: PrincipalId): Promise<Principal | null> {
    return this.data.get(id) ?? null;
  }
  async findBySubject(
    tenantId: TenantId | undefined,
    principalType: PrincipalType,
    subjectId: string,
  ): Promise<Principal | null> {
    for (const principal of this.data.values()) {
      if (
        principal.tenantId === tenantId &&
        principal.principalType === principalType &&
        principal.subjectId === subjectId
      ) {
        return principal;
      }
    }
    return null;
  }
  async listByTenant(tenantId: TenantId): Promise<Principal[]> {
    return [...this.data.values()].filter((item) => item.tenantId === tenantId);
  }
}

class MemoryRoleRepository implements RoleRepository {
  private readonly roles = new Map<string, Role>();
  private readonly links: RolePermission[] = [];

  async save(role: Role): Promise<void> {
    this.roles.set(role.id, { ...role });
  }
  async findById(id: RoleId): Promise<Role | null> {
    return this.roles.get(id) ?? null;
  }
  async findByName(tenantId: TenantId, name: string): Promise<Role | null> {
    for (const role of this.roles.values()) {
      if (role.tenantId === tenantId && role.name === name) return role;
    }
    return null;
  }
  async listByTenant(tenantId: TenantId): Promise<Role[]> {
    return [...this.roles.values()].filter((role) => role.tenantId === tenantId);
  }
  async savePermission(link: RolePermission): Promise<void> {
    const index = this.links.findIndex(
      (item) => item.roleId === link.roleId && item.permissionKey === link.permissionKey,
    );
    if (index >= 0) this.links[index] = { ...link };
    else this.links.push({ ...link });
  }
  async listPermissions(roleId: RoleId): Promise<Permission[]> {
    return this.links
      .filter((link) => link.roleId === roleId)
      .map((link) => ({
        key: link.permissionKey,
        description: link.description ?? `Izin ${link.permissionKey}`,
      }));
  }
}

export function createMemoryIdentityRepositories(): IdentityRepositories {
  return {
    tenants: new MemoryTenantRepository(),
    users: new MemoryUserRepository(),
    memberships: new MemoryMembershipRepository(),
    principals: new MemoryPrincipalRepository(),
    roles: new MemoryRoleRepository(),
  };
}
