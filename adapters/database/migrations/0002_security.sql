-- Aether — Migrasi 0002: Policy, Delegation, Approval, Audit
-- Versi: 0.1.0
-- By Anomalyid

BEGIN;

CREATE TABLE policies (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  effect         TEXT NOT NULL CHECK (effect IN ('allow','deny','require_approval')),
  actions        TEXT[] NOT NULL,
  capabilities   TEXT[],
  resources      TEXT[],
  conditions     JSONB,
  priority       INTEGER NOT NULL DEFAULT 0,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at     TIMESTAMPTZ,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE delegations (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_principal_id  TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  to_principal_id    TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
  permissions        TEXT[] NOT NULL,
  capability_scope   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ
);

CREATE TABLE approvals (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requester_principal_id TEXT NOT NULL REFERENCES principals(id),
  agent_run_id           TEXT,
  capability_id          TEXT NOT NULL,
  resource_reference     TEXT NOT NULL,
  parameter_digest       TEXT NOT NULL,
  risk_level             TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  state                  TEXT NOT NULL DEFAULT 'pending'
                         CHECK (state IN ('pending','approved','rejected','expired')),
  approver_principal_id  TEXT REFERENCES principals(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at             TIMESTAMPTZ NOT NULL,
  resolved_at            TIMESTAMPTZ
);

-- Audit LOG append-only pada level database.
-- Role aplikasi hanya diberi INSERT dan SELECT, bukan UPDATE/DELETE.
CREATE TABLE audit_logs (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  principal_id   TEXT NOT NULL,
  actor_type     TEXT NOT NULL,
  action         TEXT NOT NULL,
  resource       TEXT NOT NULL,
  outcome        TEXT NOT NULL,
  correlation_id TEXT,
  details        JSONB
);

CREATE INDEX idx_policies_tenant ON policies(tenant_id);
CREATE INDEX idx_delegations_agent ON delegations(to_principal_id);
CREATE INDEX idx_approvals_tenant_state ON approvals(tenant_id, state);
CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, occurred_at DESC);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY aether_tenant_isolation ON policies
  USING (tenant_id = current_setting('aether.tenant_id', true)::text OR tenant_id IS NULL);
CREATE POLICY aether_tenant_isolation ON delegations
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);
CREATE POLICY aether_tenant_isolation ON approvals
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);
CREATE POLICY aether_tenant_isolation ON audit_logs
  USING (tenant_id = current_setting('aether.tenant_id', true)::text);

COMMIT;
