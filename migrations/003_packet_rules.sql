-- Packet policy is JSON-backed; no historical financial rows are rewritten here.
-- Existing installations use check-packet-rules/apply-packet-rules for the
-- explicitly reviewed data/rule transition. Fresh installations seed packet v1.
INSERT INTO event_ops_migrations(version) VALUES (3) ON CONFLICT DO NOTHING;
