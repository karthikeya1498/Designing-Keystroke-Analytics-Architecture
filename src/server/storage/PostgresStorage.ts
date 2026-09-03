import { Pool } from "pg";
import type { AnalyticsSnapshot, AuditEvent, SanitizedKeystrokeEvent, SessionSummary } from "../../domain/events/models";
import type { AnomalyAssessment, BehavioralBaseline } from "../../domain/security/models";
import type { StoragePort } from "./StoragePort";

/**
 * Author: Karthikeya
 *
 * This adapter keeps runtime analytics durable and shared across app instances.
 * All values are bound parameters; behavioral payloads are stored as aggregates
 * or structured assessments and never include raw characters.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 3_000,
  statement_timeout: 5_000,
  application_name: "aegiskey-runtime",
});

async function ensureSession(sessionId: string, userId: string, startedAt: number, endedAt: number): Promise<void> {
  await pool.query(
    `INSERT INTO sessions (id, user_id, started_at, ended_at)
     VALUES ($1::uuid, (SELECT id FROM users WHERE email = $2 LIMIT 1), to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0))
     ON CONFLICT (id) DO UPDATE SET ended_at = EXCLUDED.ended_at`,
    [sessionId, userId, startedAt, endedAt],
  );
}

export const postgresStorage: StoragePort = {
  events: {
    async appendEvents(events: readonly SanitizedKeystrokeEvent[]) {
      for (const event of events) {
        await pool.query(
          `INSERT INTO keystroke_events
            (event_id, session_id, sequence_number, event_type, key_code, occurred_at, dwell_time_ms, inter_key_latency_ms, is_correction)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, to_timestamp($6 / 1000.0), $7, $8, $9)
           ON CONFLICT (event_id) DO NOTHING`,
          [event.eventId, event.sessionId, event.sequenceNumber, event.eventType, event.keyCode, event.timestamp, event.dwellTimeMs ?? null, event.interKeyLatencyMs ?? null, event.isCorrection],
        );
      }
    },
    async getLatestEvents(limit: number) {
      const result = await pool.query<SanitizedKeystrokeEvent>(
        `SELECT event_id AS "eventId", session_id AS "sessionId", sequence_number AS "sequenceNumber", event_type AS "eventType", key_code AS "keyCode", EXTRACT(EPOCH FROM occurred_at) * 1000 AS timestamp, dwell_time_ms AS "dwellTimeMs", inter_key_latency_ms AS "interKeyLatencyMs", is_correction AS "isCorrection"
         FROM keystroke_events ORDER BY received_at DESC LIMIT $1`, [limit]);
      return result.rows;
    },
  },
  analytics: {
    async saveSnapshot(snapshot: AnalyticsSnapshot) {
      await ensureSession(snapshot.sessionId, snapshot.userId, snapshot.startedAt, snapshot.endedAt);
      await pool.query(
        `INSERT INTO analytics
          (session_id, user_id, duration_seconds, key_count, backspace_count, correction_count, character_count, wpm, accuracy, mean_dwell_ms, median_dwell_ms, p95_dwell_ms, mean_interkey_ms, median_interkey_ms, p95_interkey_ms, pause_count, fatigue_score, anomaly_score, risk_level, started_at, ended_at)
         VALUES ($1::uuid, (SELECT id FROM users WHERE email = $2 LIMIT 1), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, to_timestamp($20 / 1000.0), to_timestamp($21 / 1000.0))`,
        [snapshot.sessionId, snapshot.userId, snapshot.durationSeconds ?? Math.max(0, (snapshot.endedAt - snapshot.startedAt) / 1000), snapshot.keyCount, snapshot.backspaceCount, snapshot.correctionCount, snapshot.characterCount ?? 0, snapshot.estimatedWpm, Math.max(0, Math.min(1, 1 - snapshot.errorRate)), snapshot.meanDwellMs, snapshot.medianDwellMs ?? null, snapshot.p95DwellMs, snapshot.meanInterKeyMs, snapshot.medianInterKeyMs ?? null, snapshot.p95InterKeyMs ?? null, snapshot.pauseCount ?? 0, snapshot.fatigueScore ?? 0, snapshot.anomalyScore, snapshot.riskLevel, snapshot.startedAt, snapshot.endedAt],
      );
    },
    async getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
      const result = await pool.query<SessionSummary>(
        `SELECT a.session_id AS "sessionId", u.email AS "userId", COALESCE(a.started_at, s.started_at) AS "startedAt", COALESCE(a.ended_at, s.ended_at) AS "endedAt", a.key_count AS "keyCount", a.backspace_count AS "backspaceCount", a.correction_count AS "correctionCount", a.mean_interkey_ms AS "meanInterKeyMs", a.p95_interkey_ms AS "p95InterKeyMs", a.mean_dwell_ms AS "meanDwellMs", a.p95_dwell_ms AS "p95DwellMs", a.wpm AS "estimatedWpm", 1 - a.accuracy AS "errorRate"
         FROM analytics a JOIN sessions s ON s.id = a.session_id JOIN users u ON u.id = s.user_id WHERE a.session_id = $1::uuid ORDER BY a.created_at DESC LIMIT 1`, [sessionId]);
      return result.rows[0] ?? null;
    },
  },
  audit: {
    async append(event: AuditEvent) {
      await pool.query(`INSERT INTO audit_logs (action, result, metadata, created_at) VALUES ($1, $2, $3::jsonb, to_timestamp($4 / 1000.0))`, [event.action, event.result, JSON.stringify({ actorId: event.actorId, ...(event.metadata ?? {}) }), event.timestamp]);
    },
    async listRecent(limit: number) {
      const result = await pool.query<AuditEvent>(`SELECT metadata->>'actorId' AS "actorId", action, result, EXTRACT(EPOCH FROM created_at) * 1000 AS timestamp, metadata FROM audit_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
      return result.rows;
    },
  },
  baselines: {
    async save(baseline: BehavioralBaseline) {
      await pool.query(`INSERT INTO behavioral_baselines (user_id, baseline) SELECT id, $2::jsonb FROM users WHERE email = $1 ON CONFLICT (user_id) DO UPDATE SET baseline = EXCLUDED.baseline, updated_at = now()`, [baseline.userId, JSON.stringify(baseline)]);
    },
    async get(userId: string) {
      const result = await pool.query<{ baseline: BehavioralBaseline }>(`SELECT baseline FROM behavioral_baselines b JOIN users u ON u.id = b.user_id WHERE u.email = $1 LIMIT 1`, [userId]);
      return result.rows[0]?.baseline ?? null;
    },
  },
  anomalies: {
    async append(assessment: AnomalyAssessment) {
      await ensureSession(assessment.sessionId, assessment.userId, Date.now(), Date.now());
      await pool.query(`INSERT INTO anomaly_assessments (user_id, session_id, risk_score, risk_level, confidence, is_baseline_ready, assessment) SELECT u.id, $2::uuid, $3, $4, $5, $6, $7::jsonb FROM users u WHERE u.email = $1`, [assessment.userId, assessment.sessionId, assessment.riskScore, assessment.riskLevel, assessment.confidence, assessment.isBaselineReady, JSON.stringify(assessment)]);
    },
    async listRecent(userId: string, limit: number) {
      const result = await pool.query<{ assessment: AnomalyAssessment }>(`SELECT a.assessment FROM anomaly_assessments a JOIN users u ON u.id = a.user_id WHERE u.email = $1 ORDER BY a.created_at DESC LIMIT $2`, [userId, limit]);
      return result.rows.map((row) => row.assessment);
    },
  },
};
