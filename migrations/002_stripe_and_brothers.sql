-- Additive: existing event operations and legacy records are preserved.
DO $$
DECLARE collection text;
BEGIN
 FOREACH collection IN ARRAY ARRAY['brothers','entries','attributions','checkouts','providerEvents','refunds','emailEvents'] LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I (id text PRIMARY KEY, payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = ''object'' AND payload->>''id'' = id))', 'event_ops_' || collection);
 END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS event_ops_checkout_session ON event_ops_checkouts ((payload->>'sessionId')) WHERE payload->>'sessionId' IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS event_ops_refund_provider ON event_ops_refunds ((payload->>'providerId')) WHERE payload->>'providerId' IS NOT NULL;
INSERT INTO event_ops_migrations(version) VALUES (2) ON CONFLICT DO NOTHING;
