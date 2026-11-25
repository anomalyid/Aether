import { createId } from "@aether/identifiers";
import type {
  MembershipId,
  PrincipalId,
  RoleId,
  TenantId,
  UserId,
} from "./types.js";

export const createTenantId = (): TenantId => createId("tenant") as TenantId;
export const createUserId = (): UserId => createId("usr") as UserId;
export const createPrincipalId = (): PrincipalId => createId("prin") as PrincipalId;
export const createRoleId = (): RoleId => createId("role") as RoleId;
export const createMembershipId = (): MembershipId => createId("mbr") as MembershipId;
