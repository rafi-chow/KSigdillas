-- Independent tables: this migration never changes legacy leaderboard/Eventbrite data.
CREATE TABLE IF NOT EXISTS event_ops_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS event_ops_revision (id integer PRIMARY KEY CHECK (id=1), revision bigint NOT NULL DEFAULT 0);
INSERT INTO event_ops_revision(id) VALUES (1) ON CONFLICT DO NOTHING;
DO $$
DECLARE collection text;
BEGIN
 FOREACH collection IN ARRAY ARRAY['teams','rules','ledger','receipts','orders','tickets','awards','audit','jobs','staff','sessions','submissions','attempts','settings'] LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS event_ops_%I (id text PRIMARY KEY, payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = ''object'' AND payload->>''id'' = id))', collection);
 END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS event_ops_orders_request ON event_ops_orders ((payload->>'requestKey'));
CREATE UNIQUE INDEX IF NOT EXISTS event_ops_orders_token ON event_ops_orders ((payload->>'tokenHash'));
CREATE UNIQUE INDEX IF NOT EXISTS event_ops_tickets_token ON event_ops_tickets ((payload->>'tokenHash'));
CREATE INDEX IF NOT EXISTS event_ops_tickets_order ON event_ops_tickets ((payload->>'orderId'));
CREATE INDEX IF NOT EXISTS event_ops_ledger_team ON event_ops_ledger ((payload->>'teamId'));
CREATE UNIQUE INDEX IF NOT EXISTS event_ops_ledger_source ON event_ops_ledger ((payload->>'source'));
CREATE INDEX IF NOT EXISTS event_ops_jobs_due ON event_ops_jobs ((payload->>'nextAttemptAt'));
CREATE INDEX IF NOT EXISTS event_ops_sessions_staff ON event_ops_sessions ((payload->>'staffId'));
-- Audit and score entries are immutable even if application code accidentally upserts.
CREATE OR REPLACE FUNCTION event_ops_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit and score history is append-only'; END $$;
DROP TRIGGER IF EXISTS immutable_history ON event_ops_ledger;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON event_ops_ledger FOR EACH ROW EXECUTE FUNCTION event_ops_immutable();
DROP TRIGGER IF EXISTS immutable_history ON event_ops_audit;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON event_ops_audit FOR EACH ROW EXECUTE FUNCTION event_ops_immutable();
INSERT INTO event_ops_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
