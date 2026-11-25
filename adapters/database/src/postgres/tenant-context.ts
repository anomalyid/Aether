/**
 * Konteks tenant untuk koneksi PostgreSQL.
 *
 * Row-Level Security memakai current_setting('aether.tenant_id', true).
 * set_config dengan parameter ketiga `true` membuatnya transaction-local.
 *
 * RLS adalah lapisan tambahan, BUKAN pengganti authorization aplikasi.
 *
 * By Anomalyid.
 */

import type { PoolClient } from "pg";

export async function setTenantContext(
  client: PoolClient,
  tenantId: string | undefined,
): Promise<void> {
  await client.query("SELECT set_config('aether.tenant_id', $1, true)", [tenantId ?? ""]);
}

export async function clearTenantContext(client: PoolClient): Promise<void> {
  await client.query("SELECT set_config('aether.tenant_id', '', true)");
}

export async function withTenant<T>(
  client: PoolClient,
  tenantId: string | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  await setTenantContext(client, tenantId);
  try {
    return await operation();
  } finally {
    await clearTenantContext(client);
  }
}
