/**
 * RoleService — peran tenant dan izin yang melekat padanya.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";
import { assertTenantMatch } from "./guards.js";
import { createRoleId } from "./ids.js";
import type { Role, RoleId, TenantId } from "./types.js";
import type { RoleRepository, TenantRepository } from "./repositories.js";

const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]*$/;

export interface CreateRoleInput {
  tenantId: string;
  name: string;
  description?: string;
}

export class RoleService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly tenants: TenantRepository,
  ) {}

  async create(input: CreateRoleInput): Promise<Role> {
    const tenantId = input.tenantId as TenantId;
    const tenant = await this.tenants.findById(tenantId);
    if (tenant === null || tenant.status !== "active") {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Tenant tidak tersedia untuk pembuatan role.", {
        category: "authorization",
        retryable: false,
      });
    }

    const name = (input.name ?? "").trim().toLowerCase();
    if (!PERMISSION_PATTERN.test(name)) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Nama role tidak valid.", {
        category: "validation",
        retryable: false,
      });
    }
    if ((await this.roles.findByName(tenantId, name)) !== null) {
      throw new AetherError(ErrorCode.RESOURCE_CONFLICT, "Role sudah ada di tenant ini.", {
        category: "execution",
        retryable: false,
      });
    }

    const role: Role = {
      id: createRoleId(),
      tenantId,
      name,
      ...(input.description === undefined ? {} : { description: input.description }),
    };
    await this.roles.save(role);
    return role;
  }

  async get(tenantId: string, roleId: string): Promise<Role> {
    const role = await this.roles.findById(roleId as RoleId);
    if (role === null) throw this.notFound();
    assertTenantMatch(role.tenantId, tenantId, "Role");
    return role;
  }

  async grantPermission(
    tenantId: string,
    roleId: string,
    permissionKey: string,
    description: string,
  ): Promise<void> {
    const role = await this.get(tenantId, roleId);
    if (!PERMISSION_PATTERN.test(permissionKey)) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Permission key tidak valid.", {
        category: "validation",
        retryable: false,
      });
    }
    await this.roles.savePermission({
      roleId: role.id,
      permissionKey,
      ...(description === undefined ? {} : { description }),
    });
  }

  async listPermissions(tenantId: string, roleId: string): Promise<string[]> {
    const role = await this.get(tenantId, roleId);
    const permissions = await this.roles.listPermissions(role.id);
    return permissions.map((permission) => permission.key);
  }

  private notFound(): AetherError {
    return new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Role tidak ditemukan.", {
      category: "validation",
      retryable: false,
    });
  }
}
