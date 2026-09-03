-- AegisKey runtime analytics persistence extension.
-- Author: Karthikeya
-- Rationale: the initial schema modeled the domain, but runtime analytics require
-- user ownership, complete feature fields, and durable baseline/assessment JSON.

ALTER TABLE analytics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0);
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS character_count INTEGER NOT NULL DEFAULT 0 CHECK (character_count >= 0);
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS median_dwell_ms NUMERIC(10, 2);
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS median_interkey_ms NUMERIC(10, 2);
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS p95_interkey_ms NUMERIC(10, 2);
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS pause_count INTEGER NOT NULL DEFAULT 0 CHECK (pause_count >= 0);
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS fatigue_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (fatigue_score BETWEEN 0 AND 100);
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'BASELINE_BUILDING' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BASELINE_BUILDING'));
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS analytics_user_created_idx ON analytics(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS behavioral_baselines (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  baseline JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anomaly_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  risk_score NUMERIC(6, 3),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BASELINE_BUILDING')),
  confidence NUMERIC(5, 4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  is_baseline_ready BOOLEAN NOT NULL,
  assessment JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_user_created_idx ON anomaly_assessments(user_id, created_at DESC);
