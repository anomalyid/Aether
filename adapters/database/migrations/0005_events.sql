-- Aether — Migrasi 0005: Event outbox dan idempotency consumer
-- Versi: 0.1.0
-- By Anomalyid

BEGIN;

CREATE TABLE outbox_events (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  event_id       TEXT NOT NULL UNIQUE,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ
);

CREATE TABLE processed_events (
  consumer_id    TEXT NOT NULL,
  event_id       TEXT NOT NULL,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_id, event_id)
);

CREATE INDEX idx_outbox_pending ON outbox_events(published_at, created_at);

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY aether_tenant_isolation ON outbox_events
  USING (tenant_id = current_setting('aether.tenant_id', true)::text OR tenant_id IS NULL);

COMMIT;
