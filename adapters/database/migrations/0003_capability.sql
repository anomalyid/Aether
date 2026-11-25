-- Aether — Migrasi 0003: Capability registry, invocation, idempotency
-- Versi: 0.1.0
-- By Anomalyid

BEGIN;

CREATE TABLE capability_definitions (
  id               TEXT NOT NULL,
  version          TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  input_schema     JSONB NOT NULL,
  output_schema    JSONB NOT NULL,
  risk_level       TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  permissions      TEXT[] NOT NULL,
  idempotency      TEXT NOT NULL CHECK (idempotency IN ('required','supported','unsupported')),
  timeout_ms       INTEGER NOT NULL,
  owner            TEXT NOT NULL,
  provider         TEXT NOT NULL,
  tenant_id        TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  deprecated       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

CREATE TABLE capability_invocations (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability_id    TEXT NOT NULL,
  capability_version TEXT NOT NULL,
  principal_id     TEXT NOT NULL,
  agent_run_id     TEXT,
  status           TEXT NOT NULL CHECK (status IN ('completed','failed','awaiting_approval','cancelled')),
  input_digest     TEXT NOT NULL,
  approval_id      TEXT REFERENCES approvals(id),
  error_code       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

CREATE TABLE idempotency_records (
  key              TEXT NOT NULL,
  tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  input_digest     TEXT NOT NULL,
  result           JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);

CREATE INDEX idx_cap_def_tenant ON capability_definitions(tenant_id);
CREATE INDEX idx_cap_inv_tenant_time ON capability_invocations(tenant_id, created_at DESC);

ALTER TABLE capability_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY aether_tenant_isolation ON capability_definitions
  USING (tenant_id = current_setting('aether.tenant_id', true)::text OR tenant_id IS NULL);
CREATE POLICY aether_tenant_isolation ON capability_invocations
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);
CREATE POLICY aether_tenant_isolation ON idempotency_records
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);

COMMIT;
