#!/usr/bin/env bash
set -euo pipefail

DB="aegiskey_validation_$$_$(date +%s)"
cleanup() { sudo -u postgres dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

sudo -u postgres createdb "$DB"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f database/migrations/001_initial_privacy_schema.sql >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f database/migrations/001_initial_privacy_schema.sql >/dev/null

test "$(sudo -u postgres psql -At -d "$DB" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','sessions','keystroke_events','analytics','anomaly_events','security_alerts','audit_logs');")" = 7
test "$(sudo -u postgres psql -At -d "$DB" -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('sessions_user_started_idx','events_session_sequence_idx','events_session_occurred_idx','analytics_session_created_idx','anomaly_session_created_idx','security_user_created_idx','audit_created_idx');")" = 7
test "$(sudo -u postgres psql -At -d "$DB" -c "SELECT count(*) FROM information_schema.columns WHERE table_name='keystroke_events' AND column_name IN ('event_id','session_id','sequence_number','event_type','key_code','occurred_at','dwell_time_ms','inter_key_latency_ms','is_correction','received_at');")" = 10

echo "postgres migration validation passed"
