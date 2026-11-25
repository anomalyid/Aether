-- Aether — Migrasi 0001: Identity & tenant boundary
-- Versi: 0.1.0
-- By Anomalyid
--
-- CATATAN: Row-Level Security adalah lapisan perlindungan TAMBAHAN.
-- Ia TIDAK menggantikan authorization pada application layer.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Parameter sesi: aether.tenant_id harus ditetapkan oleh application layer
-- pada setiap transaksi tenant. Request tanpa tenant tidak boleh membaca data tenant.

CREATE TABLE tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  UNIQUE (tenant_id, name)
);

CREATE TABLE permissions (
  key           TEXT PRIMARY KEY,
  description   TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  description   TEXT,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE memberships (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'removed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, role_id)
);

CREATE TABLE principals (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL
                CHECK (principal_type IN ('user','agent','service','integration','workload')),
  subject_id    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'revoked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, principal_type, subject_id)
);

CREATE INDEX idx_roles_tenant ON roles(tenant_id);
CREATE INDEX idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_principals_tenant ON principals(tenant_id);

-- Row-Level Security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE principals ENABLE ROW LEVEL SECURITY;

CREATE POLICY aether_tenant_isolation ON roles
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);
CREATE POLICY aether_tenant_isolation ON memberships
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);
CREATE POLICY aether_tenant_isolation ON principals
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);

-- Tabel tenants sengaja tidak memakai RLS: application layer menentukan
-- tenant mana yang boleh dibaca berdasarkan membership principal.

COMMIT;
