/**
 * Repository Identity berbasis PostgreSQL dengan tenant context.
 *
 * Tabel tenants/users tidak memakai RLS; tabel lain memakai RLS dan
 * diakses melalui PgTenantRunner dengan set_config transaction-local.
 *
 * By Anomalyid.
 */

import type { Pool, PoolClient } from "pg";
import type {
  IdentityRepositories,
  Membership,
  MembershipId,
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

type Row = Record<string, unknown>;

const str = (row: Row, key: string): string => String(row[key]);
const optional = (row: Row, key: string): string | undefined =>
  row[key] === null || row[key] === undefined ? undefined : String(row[key]);
const list = (row: Row, key: string): string[] =>
  Array.isArray(row[key]) ? row[key].map((item) => String(item)) : [];
const timestamp = (row: Row, key: string): string => {
  const value = row[key];
  return value instanceof Date ? value.toISOString() : String(value);
};

export class PgTenantRunner {
  constructor(private readonly pool: Pool) {}

  async run<T>(
    tenantId: string | undefined,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('aether.tenant_id', $1, true)", [tenantId ?? ""]);
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async global<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await operation(client);
    } finally {
      client.release();
    }
  }
}

function mapTenant(row: Row): Tenant {
  return {
    id: str(row, "id") as TenantId,
    name: str(row, "name"),
    slug: str(row, "slug"),
    status: str(row, "status") as Tenant["status"],
    createdAt: timestamp(row, "created_at"),
    updatedAt: timestamp(row, "updated_at"),
  };
}

function mapUser(row: Row): User {
  return {
    id: str(row, "id") as UserId,
    email: str(row, "email"),
    displayName: str(row, "display_name"),
    status: str(row, "status") as User["status"],
    createdAt: timestamp(row, "created_at"),
    updatedAt: timestamp(row, "updated_at"),
  };
}

function mapRole(row: Row): Role {
  return {
    id: str(row, "id") as RoleId,
    tenantId: str(row, "tenant_id") as TenantId,
    name: str(row, "name"),
    ...(optional(row, "description") === undefined ? {} : { description: optional(row, "description") as string }),
  };
}

function mapMembership(row: Row): Membership {
  return {
    id: str(row, "id") as MembershipId,
    tenantId: str(row, "tenant_id") as TenantId,
    userId: str(row, "user_id") as UserId,
    roleId: str(row, "role_id") as RoleId,
    status: str(row, "status") as Membership["status"],
    createdAt: timestamp(row, "created_at"),
  };
}

function mapPrincipal(row: Row): Principal {
  return {
    id: str(row, "id") as PrincipalId,
    ...(optional(row, "tenant_id") === undefined ? {} : { tenantId: optional(row, "tenant_id") as TenantId }),
    principalType: str(row, "principal_type") as PrincipalType,
    subjectId: str(row, "subject_id"),
    status: str(row, "status") as Principal["status"],
    createdAt: timestamp(row, "created_at"),
  };
}

class PgTenantRepository implements TenantRepository {
  constructor(private readonly runner: PgTenantRunner) {}

  async save(tenant: Tenant): Promise<void> {
    await this.runner.global((client) =>
      client.query(
        `INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug,
           status=EXCLUDED.status, updated_at=EXCLUDED.updated_at`,
        [tenant.id, tenant.name, tenant.slug, tenant.status, tenant.createdAt, tenant.updatedAt],
      ),
    );
  }

  async findById(id: TenantId): Promise<Tenant | null> {
    const result = await this.runner.global((client) =>
      client.query("SELECT * FROM tenants WHERE id = $1", [id]),
    );
    const row = result.rows[0];
    return row === undefined ? null : mapTenant(row as Row);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const result = await this.runner.global((client) =>
      client.query("SELECT * FROM tenants WHERE slug = $1", [slug]),
    );
    const row = result.rows[0];
    return row === undefined ? null : mapTenant(row as Row);
  }

  async list(): Promise<Tenant[]> {
    const result = await this.runner.global((client) => client.query("SELECT * FROM tenants ORDER BY created_at"));
    return result.rows.map((row) => mapTenant(row as Row));
  }
}

class PgUserRepository implements UserRepository {
  constructor(private readonly runner: PgTenantRunner) {}

  async save(user: User): Promise<void> {
    await this.runner.global((client) =>
      client.query(
        `INSERT INTO users (id, email, display_name, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,
           display_name=EXCLUDED.display_name, status=EXCLUDED.status,
           updated_at=EXCLUDED.updated_at`,
        [user.id, user.email, user.displayName, user.status, user.createdAt, user.updatedAt],
      ),
    );
  }

  async findById(id: UserId): Promise<User | null> {
    const result = await this.runner.global((client) => client.query("SELECT * FROM users WHERE id = $1", [id]));
    const row = result.rows[0];
    return row === undefined ? null : mapUser(row as Row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.runner.global((client) => client.query("SELECT * FROM users WHERE email = $1", [email]));
    const row = result.rows[0];
    return row === undefined ? null : mapUser(row as Row);
  }

  async list(): Promise<User[]> {
    const result = await this.runner.global((client) => client.query("SELECT * FROM users ORDER BY created_at"));
    return result.rows.map((row) => mapUser(row as Row));
  }
}

class PgRoleRepository implements RoleRepository {
  constructor(
    private readonly runner: PgTenantRunner,
    private readonly tenantId: string,
  ) {}

  private run<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.runner.run(this.tenantId, operation);
  }

  async save(role: Role): Promise<void> {
    await this.run((client) =>
      client.query(
        `INSERT INTO roles (id, tenant_id, name, description)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description`,
        [role.id, role.tenantId, role.name, role.description ?? null],
      ),
    );
  }

  async findById(id: RoleId): Promise<Role | null> {
    const result = await this.run((client) => client.query("SELECT * FROM roles WHERE id = $1", [id]));
    const row = result.rows[0];
    return row === undefined ? null : mapRole(row as Row);
  }

  async findByName(tenantId: TenantId, name: string): Promise<Role | null> {
    const result = await this.run((client) =>
      client.query("SELECT * FROM roles WHERE tenant_id = $1 AND name = $2", [tenantId, name]),
    );
    const row = result.rows[0];
    return row === undefined ? null : mapRole(row as Row);
  }

  async listByTenant(tenantId: TenantId): Promise<Role[]> {
    const result = await this.run((client) =>
      client.query("SELECT * FROM roles WHERE tenant_id = $1", [tenantId]),
    );
    return result.rows.map((row) => mapRole(row as Row));
  }

  async savePermission(link: RolePermission): Promise<void> {
    await this.run(async (client) => {
      await client.query(
        "INSERT INTO permissions (key, description) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING",
        [link.permissionKey, link.description ?? `Izin ${link.permissionKey}`],
      );
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_key, description)
         VALUES ($1,$2,$3)
         ON CONFLICT (role_id, permission_key) DO UPDATE SET description=EXCLUDED.description`,
        [link.roleId, link.permissionKey, link.description ?? null],
      );
    });
  }

  async listPermissions(roleId: RoleId): Promise<Permission[]> {
    const result = await this.run((client) =>
      client.query(
        `SELECT p.key, COALESCE(rp.description, p.description) AS description
         FROM role_permissions rp JOIN permissions p ON p.key = rp.permission_key
         WHERE rp.role_id = $1`,
        [roleId],
      ),
    );
    return result.rows.map((row) => ({
      key: str(row as Row, "key"),
      description: str(row as Row, "description"),
    }));
  }
}

class PgMembershipRepository implements MembershipRepository {
  constructor(
    private readonly runner: PgTenantRunner,
    private readonly tenantId: string,
  ) {}

  private run<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.runner.run(this.tenantId, operation);
  }

  async save(membership: Membership): Promise<void> {
    await this.run((client) =>
      client.query(
        `INSERT INTO memberships (id, tenant_id, user_id, role_id, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, user_id, role_id) DO UPDATE SET status=EXCLUDED.status`,
        [membership.id, membership.tenantId, membership.userId, membership.roleId, membership.status, membership.createdAt],
      ),
    );
  }

  async findById(id: string): Promise<Membership | null> {
    const result = await this.run((client) => client.query("SELECT * FROM memberships WHERE id = $1", [id]));
    const row = result.rows[0];
    return row === undefined ? null : mapMembership(row as Row);
  }

  async findByUserAndRole(userId: UserId, roleId: RoleId): Promise<Membership | null> {
    const result = await this.run((client) =>
      client.query("SELECT * FROM memberships WHERE user_id = $1 AND role_id = $2", [userId, roleId]),
    );
    const row = result.rows[0];
    return row === undefined ? null : mapMembership(row as Row);
  }

  async listByTenant(tenantId: TenantId): Promise<Membership[]> {
    const result = await this.run((client) =>
      client.query("SELECT * FROM memberships WHERE tenant_id = $1", [tenantId]),
    );
    return result.rows.map((row) => mapMembership(row as Row));
  }

  async listByUser(userId: UserId): Promise<Membership[]> {
    const result = await this.run((client) =>
      client.query("SELECT * FROM memberships WHERE user_id = $1", [userId]),
    );
    return result.rows.map((row) => mapMembership(row as Row));
  }
}

class PgPrincipalRepository implements PrincipalRepository {
  constructor(
    private readonly runner: PgTenantRunner,
    private readonly tenantId: string | undefined,
  ) {}

  private run<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.runner.run(this.tenantId, operation);
  }

  async save(principal: Principal): Promise<void> {
    await this.run((client) => {
      if (principal.tenantId === undefined) {
        return client.query(
          `INSERT INTO principals (id, tenant_id, principal_type, subject_id, status, created_at)
           VALUES ($1,NULL,$2,$3,$4,$5)
           ON CONFLICT (principal_type, subject_id) WHERE tenant_id IS NULL
           DO UPDATE SET status=EXCLUDED.status`,
          [principal.id, principal.principalType, principal.subjectId, principal.status, principal.createdAt],
        );
      }
      return client.query(
        `INSERT INTO principals (id, tenant_id, principal_type, subject_id, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, principal_type, subject_id)
         DO UPDATE SET status=EXCLUDED.status`,
        [principal.id, principal.tenantId, principal.principalType, principal.subjectId, principal.status, principal.createdAt],
      );
    });
  }

  async findById(id: PrincipalId): Promise<Principal | null> {
    const result = await this.run((client) => client.query("SELECT * FROM principals WHERE id = $1", [id]));
    const row = result.rows[0];
    return row === undefined ? null : mapPrincipal(row as Row);
  }

  async findBySubject(
    tenantId: TenantId | undefined,
    principalType: PrincipalType,
    subjectId: string,
  ): Promise<Principal | null> {
    const result = await this.runner.run(tenantId, (client) =>
      tenantId === undefined
        ? client.query(
            "SELECT * FROM principals WHERE tenant_id IS NULL AND principal_type = $1 AND subject_id = $2",
            [principalType, subjectId],
          )
        : client.query(
            "SELECT * FROM principals WHERE tenant_id = $1 AND principal_type = $2 AND subject_id = $3",
            [tenantId, principalType, subjectId],
          ),
    );
    const row = result.rows[0];
    return row === undefined ? null : mapPrincipal(row as Row);
  }

  async listByTenant(tenantId: TenantId): Promise<Principal[]> {
    const result = await this.runner.run(tenantId, (client) =>
      client.query("SELECT * FROM principals WHERE tenant_id = $1", [tenantId]),
    );
    return result.rows.map((row) => mapPrincipal(row as Row));
  }
}

export function createPgIdentityRepositories(
  pool: Pool,
  tenantId?: string,
): IdentityRepositories {
  const runner = new PgTenantRunner(pool);
  return {
    tenants: new PgTenantRepository(runner),
    users: new PgUserRepository(runner),
    roles: new PgRoleRepository(runner, tenantId ?? ""),
    memberships: new PgMembershipRepository(runner, tenantId ?? ""),
    principals: new PgPrincipalRepository(runner, tenantId),
  };
}
