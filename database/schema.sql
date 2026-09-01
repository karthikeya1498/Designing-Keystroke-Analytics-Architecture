CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('USER', 'ANALYST', 'ADMIN')) DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  key_count INTEGER NOT NULL CHECK (key_count >= 0),
  backspace_count INTEGER NOT NULL CHECK (backspace_count >= 0),
  correction_count INTEGER NOT NULL CHECK (correction_count >= 0),
  wpm NUMERIC(8, 2) NOT NULL CHECK (wpm >= 0),
  accuracy NUMERIC(5, 4) NOT NULL CHECK (accuracy BETWEEN 0 AND 1),
  mean_dwell_ms NUMERIC(10, 2),
  p95_dwell_ms NUMERIC(10, 2),
  mean_interkey_ms NUMERIC(10, 2),
  p95_interkey_ms NUMERIC(10, 2),
  anomaly_score NUMERIC(6, 3) CHECK (anomaly_score IS NULL OR anomaly_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anomaly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  deviation_z NUMERIC(8, 3) NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')) DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'DENIED', 'FAILED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_started_idx ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS analytics_session_created_idx ON analytics(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anomaly_session_created_idx ON anomaly_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_user_created_idx ON security_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);
