/**
 * Port repository Identity.
 *
 * Domain mendefinisikan kontrak; implementasi ada di adapters/.
 * Domain dilarang mengetahui SQL, ORM, atau library database tertentu.
 *
 * By Anomalyid.
 */

import type {
  Membership,
  Permission,
  Principal,
  PrincipalId,
  PrincipalType,
  Role,
  RoleId,
  RolePermission,
  Tenant,
  TenantId,
  User,
  UserId,
} from "./types.js";

export interface TenantRepository {
  save(tenant: Tenant): Promise<void>;
  findById(id: TenantId): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  list(): Promise<Tenant[]>;
}

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
}

export interface MembershipRepository {
  save(membership: Membership): Promise<void>;
  findById(id: string): Promise<Membership | null>;
  findByUserAndRole(userId: UserId, roleId: RoleId): Promise<Membership | null>;
  listByTenant(tenantId: TenantId): Promise<Membership[]>;
  listByUser(userId: UserId): Promise<Membership[]>;
}

export interface PrincipalRepository {
  save(principal: Principal): Promise<void>;
  findById(id: PrincipalId): Promise<Principal | null>;
  findBySubject(
    tenantId: TenantId | undefined,
    principalType: PrincipalType,
    subjectId: string,
  ): Promise<Principal | null>;
  listByTenant(tenantId: TenantId): Promise<Principal[]>;
}

export interface RoleRepository {
  save(role: Role): Promise<void>;
  findById(id: RoleId): Promise<Role | null>;
  findByName(tenantId: TenantId, name: string): Promise<Role | null>;
  listByTenant(tenantId: TenantId): Promise<Role[]>;
  savePermission(link: RolePermission): Promise<void>;
  listPermissions(roleId: RoleId): Promise<Permission[]>;
}

export interface IdentityRepositories {
  tenants: TenantRepository;
  users: UserRepository;
  memberships: MembershipRepository;
  principals: PrincipalRepository;
  roles: RoleRepository;
}
