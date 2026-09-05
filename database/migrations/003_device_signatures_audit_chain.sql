-- AegisKey device identity and tamper-evident audit extension.
-- Author: Karthikeya
-- Rationale: bind sanitized telemetry to an enrolled device key and make future
-- audit records cryptographically linkable without storing raw typed content.
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 128),
  algorithm TEXT NOT NULL CHECK (algorithm IN ('Ed25519')),
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS devices_user_created_idx ON devices(user_id, created_at DESC);
ALTER TABLE keystroke_events ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES devices(id) ON DELETE SET NULL;
ALTER TABLE keystroke_events ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entry_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS hash_algorithm TEXT NOT NULL DEFAULT 'sha256';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS audit_timestamp_ms BIGINT;
UPDATE audit_logs SET audit_timestamp_ms = round(EXTRACT(EPOCH FROM created_at) * 1000)::bigint WHERE audit_timestamp_ms IS NULL;
CREATE INDEX IF NOT EXISTS audit_chain_idx ON audit_logs(created_at ASC, id ASC);

-- Existing development records are marked as a genesis-era chain. New records
-- are always written with a previous_hash and entry_hash by the application.
UPDATE audit_logs
SET entry_hash = COALESCE(entry_hash, encode(digest(id::text || ':' || action || ':' || result || ':' || metadata::text || ':' || created_at::text, 'sha256'), 'hex')),
    hash_algorithm = CASE WHEN previous_hash IS NULL THEN 'legacy-sha256' ELSE hash_algorithm END
WHERE entry_hash IS NULL OR previous_hash IS NULL;
