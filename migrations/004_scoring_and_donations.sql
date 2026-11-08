-- Additive records; existing orders and ticket tokens remain intact.
CREATE TABLE IF NOT EXISTS event_ops_admissions (id text PRIMARY KEY, payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND payload->>'id' = id));
CREATE TABLE IF NOT EXISTS event_ops_donations (id text PRIMARY KEY, payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND payload->>'id' = id));
CREATE UNIQUE INDEX IF NOT EXISTS event_ops_admission_code ON event_ops_admissions ((payload->>'code'));
CREATE UNIQUE INDEX IF NOT EXISTS event_ops_donation_payment ON event_ops_donations ((payload->>'paymentId'));
INSERT INTO event_ops_migrations(version) VALUES (4) ON CONFLICT DO NOTHING;
