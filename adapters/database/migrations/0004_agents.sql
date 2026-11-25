-- Aether — Migrasi 0004: Agent definitions, runs, evaluation
-- Versi: 0.1.0
-- By Anomalyid

BEGIN;

CREATE TABLE agent_definitions (
  id              TEXT NOT NULL,
  version         TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  instructions    TEXT NOT NULL,
  skills          TEXT[] NOT NULL,
  allowed_capabilities TEXT[] NOT NULL,
  model_profile   TEXT NOT NULL,
  model_provider  TEXT,
  model_name      TEXT,
  limits          JSONB NOT NULL,
  approval_policy TEXT NOT NULL DEFAULT 'default',
  tenant_id       TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

CREATE TABLE agent_runs (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  agent_version   TEXT NOT NULL,
  principal_id    TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN (
    'CREATED','VALIDATING','QUEUED','RUNNING','WAITING_TOOL','WAITING_APPROVAL',
    'RESUMING','COMPLETED','FAILED','CANCELLED','EXPIRED')),
  input           JSONB NOT NULL,
  output          JSONB,
  error           JSONB,
  correlation_id  TEXT,
  approval_id     TEXT REFERENCES approvals(id),
  steps           INTEGER NOT NULL DEFAULT 0,
  model_calls     INTEGER NOT NULL DEFAULT 0,
  tool_calls      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evaluation_records (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  agent_version   TEXT NOT NULL,
  run_id          TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  dimensions      JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_runs_tenant_time ON agent_runs(tenant_id, created_at DESC);
CREATE INDEX idx_eval_agent_version ON evaluation_records(agent_id, agent_version);

ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY aether_tenant_isolation ON agent_definitions
  USING (tenant_id = current_setting('aether.tenant_id', true)::text OR tenant_id IS NULL);
CREATE POLICY aether_tenant_isolation ON agent_runs
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);
CREATE POLICY aether_tenant_isolation ON evaluation_records
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);

COMMIT;
