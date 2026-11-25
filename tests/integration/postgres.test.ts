/**
 * Uji integrasi PostgreSQL sungguhan.
 *
 * Jalankan dengan:
 *   AETHER_TEST_DATABASE_URL=postgres://... pnpm test:integration
 *
 * Penting: koneksi uji memakai role aplikasi NON-superuser karena superuser
 * melewati Row-Level Security.
 *
 * By Anomalyid.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { runMigrations, withTenant } from "@aether/database";

const connectionString = process.env.AETHER_TEST_DATABASE_URL;
const describeDb = connectionString === undefined ? describe.skip : describe;

let adminPool: Pool;
let appPool: Pool;

const APP_ROLE = "aether_app";
const APP_PASSWORD = "aether_app";

function appConnectionString(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}

describeDb("PostgreSQL — migrasi dan Row-Level Security", () => {
  beforeAll(async () => {
    adminPool = new Pool({ connectionString });
    await runMigrations(adminPool);

    await adminPool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
    `);
    await adminPool.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    await adminPool.query(`GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
    await adminPool.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT ON TABLES TO ${APP_ROLE}`,
    );

    appPool = new Pool({ connectionString: appConnectionString(connectionString as string) });
  });

  afterAll(async () => {
    await appPool?.end();
    await adminPool?.end();
  });

  it("migrasi idempoten", async () => {
    const applied = await runMigrations(adminPool);
    expect(applied).toEqual([]);
    const result = await adminPool.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    expect(result.rows.map((row) => row.name)).toContain("0001_identity.sql");
    expect(result.rows).toHaveLength(5);
  });

  it("mengisolasi principal antar tenant melalui RLS", async () => {
    const suffix = Date.now().toString(36);
    const tenantA = `tenant_a_${suffix}`;
    const tenantB = `tenant_b_${suffix}`;

    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)", [tenantA, "A", `a-${suffix}`]);
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)", [tenantB, "B", `b-${suffix}`]);

      await withTenant(client, tenantA, async () => {
        await client.query(
          "INSERT INTO principals (id, tenant_id, principal_type, subject_id) VALUES ($1,$2,$3,$4)",
          [`prin_a_${suffix}`, tenantA, "user", `user_a_${suffix}`],
        );
      });
      await withTenant(client, tenantB, async () => {
        await client.query(
          "INSERT INTO principals (id, tenant_id, principal_type, subject_id) VALUES ($1,$2,$3,$4)",
          [`prin_b_${suffix}`, tenantB, "user", `user_b_${suffix}`],
        );
      });

      await withTenant(client, tenantA, async () => {
        const visible = await client.query<{ id: string }>(
          "SELECT id FROM principals WHERE id LIKE $1",
          [`prin_%_${suffix}`],
        );
        expect(visible.rows.map((row) => row.id)).toEqual([`prin_a_${suffix}`]);
      });

      await withTenant(client, tenantB, async () => {
        const visible = await client.query<{ id: string }>(
          "SELECT id FROM principals WHERE id LIKE $1",
          [`prin_%_${suffix}`],
        );
        expect(visible.rows.map((row) => row.id)).toEqual([`prin_b_${suffix}`]);
      });

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("mengisolasi audit log antar tenant", async () => {
    const suffix = Date.now().toString(36);
    const tenantA = `audit_a_${suffix}`;
    const tenantB = `audit_b_${suffix}`;
    const client = await appPool.connect();

    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)", [tenantA, "Audit A", `aa-${suffix}`]);
      await client.query("INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)", [tenantB, "Audit B", `ab-${suffix}`]);

      for (const tenant of [tenantA, tenantB]) {
        await withTenant(client, tenant, async () => {
          await client.query(
            "INSERT INTO audit_logs (id, tenant_id, principal_id, actor_type, action, resource, outcome) VALUES ($1,$2,$3,$4,$5,$6,$7)",
            [`audit_${tenant}`, tenant, `p_${tenant}`, "agent", "capability.invoke", "messaging.send", "executed"],
          );
        });
      }

      await withTenant(client, tenantA, async () => {
        const result = await client.query<{ id: string }>(
          "SELECT id FROM audit_logs WHERE id LIKE $1",
          [`audit_audit_%_${suffix}`],
        );
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]?.id).toBe(`audit_${tenantA}`);
      });

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("mencegah akses tanpa tenant context", async () => {
    const client = await appPool.connect();
    try {
      await withTenant(client, undefined, async () => {
        const result = await client.query<{ id: string }>("SELECT id FROM principals LIMIT 1");
        expect(result.rows).toHaveLength(0);
      });
    } finally {
      client.release();
    }
  });
});
