/**
 * Tipe domain Identity Aether.
 *
 * Identity Domain adalah pemilik user, tenant, membership, principal, role,
 * dan permission. Domain lain dilarang menulis langsung ke data ini.
 *
 * By Anomalyid.
 */

declare const BRAND: unique symbol;
export type Branded<T, B extends string> = T & { readonly [BRAND]: B };

export type TenantId = Branded<string, "TenantId">;
export type UserId = Branded<string, "UserId">;
export type PrincipalId = Branded<string, "PrincipalId">;
export type RoleId = Branded<string, "RoleId">;
export type MembershipId = Branded<string, "MembershipId">;

export type TenantStatus = "active" | "suspended" | "deleted";
export type UserStatus = "active" | "suspended" | "deleted";
export type MembershipStatus = "active" | "removed";
export type PrincipalStatus = "active" | "revoked";

export type PrincipalType =
  | "user"
  | "agent"
  | "service"
  | "integration"
  | "workload";

export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: UserId;
  email: string;
  displayName: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: MembershipId;
  tenantId: TenantId;
  userId: UserId;
  roleId: RoleId;
  status: MembershipStatus;
  createdAt: string;
}

export interface Principal {
  id: PrincipalId;
  tenantId?: TenantId;
  principalType: PrincipalType;
  subjectId: string;
  status: PrincipalStatus;
  createdAt: string;
}

export interface Role {
  id: RoleId;
  tenantId: TenantId;
  name: string;
  description?: string;
}

export interface Permission {
  key: string;
  description: string;
}

export interface RolePermission {
  roleId: RoleId;
  permissionKey: string;
  description?: string;
}

export interface TenantContext {
  tenantId: TenantId;
  principalId?: PrincipalId;
}
