/**
 * Migration runner PostgreSQL Aether.
 *
 * Setiap migrasi dijalankan dalam satu transaksi dan dicatat di
 * schema_migrations sehingga idempoten.
 *
 * By Anomalyid.
 */

import { readFile } from "node:fs/promises";
import type { Pool } from "pg";

export const MIGRATION_ORDER = [
  "0001_identity.sql",
  "0002_security.sql",
  "0003_capability.sql",
  "0004_agents.sql",
  "0005_events.sql",
  "0006_principal_global_unique.sql",
] as const;

const MIGRATIONS_URL = new URL("../../migrations/", import.meta.url);

export async function runMigrations(pool: Pool): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );

  const result = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(result.rows.map((row) => row.name));
  const newlyApplied: string[] = [];

  for (const name of MIGRATION_ORDER) {
    if (applied.has(name)) continue;
    const raw = await readFile(new URL(name, MIGRATIONS_URL), "utf8");
    const sql = raw
      .replace(/^\s*BEGIN;\s*/im, "")
      .replace(/\s*COMMIT;\s*$/im, "");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      newlyApplied.push(name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return newlyApplied;
}
