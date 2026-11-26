-- Aether — Migrasi 0006: uniqueness principal global
-- By Anomalyid
--
-- UNIQUE biasa dengan tenant_id NULL tidak mencegah duplikat karena NULL
-- tidak dianggap sama. Index parsial ini menutup celah tersebut.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS principals_global_unique
  ON principals (principal_type, subject_id)
  WHERE tenant_id IS NULL;

-- Principal platform (tenant_id NULL) hanya terlihat ketika tidak ada
-- tenant context aktif. Dengan tenant context, baris tetap tersembunyi.
CREATE POLICY aether_platform_principal_read ON principals
  FOR SELECT USING (
    tenant_id IS NULL AND (
      current_setting('aether.tenant_id', true) IS NULL
      OR current_setting('aether.tenant_id', true) = ''
    )
  );

CREATE POLICY aether_platform_principal_write ON principals
  FOR INSERT WITH CHECK (
    tenant_id IS NULL AND (
      current_setting('aether.tenant_id', true) IS NULL
      OR current_setting('aether.tenant_id', true) = ''
    )
  );

COMMIT;
