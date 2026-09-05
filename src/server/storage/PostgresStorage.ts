import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { AnalyticsSnapshot, AuditEvent, SanitizedKeystrokeEvent, SessionSummary } from "../../domain/events/models";
import type { AnomalyAssessment, BehavioralBaseline, SecurityAlert } from "../../domain/security/models";
import type { AuditIntegrityResult, DeviceRegistration, EnrolledDevice } from "../../domain/security/deviceModels";
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

function auditEntryHash(previousHash: string, event: { actorId: string; action: string; timestamp: number; result: string; metadata: Record<string, string | number | boolean> }): string {
  return createHash("sha256").update(JSON.stringify({ previousHash, actorId: event.actorId, action: event.action, timestamp: event.timestamp, result: event.result, metadata: event.metadata })).digest("hex");
}

function mapDevice(row: { id: string; userId: string; name: string; algorithm: "Ed25519"; publicKey: string; createdAt: number; lastSeenAt?: number; revokedAt?: number }): EnrolledDevice {
  return row;
}

export async function checkPostgresHealth(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

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
    async ensureSession(sessionId: string, userId: string, startedAt: number, endedAt: number) {
      await ensureSession(sessionId, userId, startedAt, endedAt);
    },
    async appendEvents(events: readonly SanitizedKeystrokeEvent[]) {
      let accepted = 0;
      let replayed = 0;
      for (const event of events) {
        const result = await pool.query(
          `INSERT INTO keystroke_events
            (event_id, session_id, sequence_number, event_type, key_code, occurred_at, dwell_time_ms, inter_key_latency_ms, is_correction, device_id, signature_verified)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, to_timestamp($6 / 1000.0), $7, $8, $9, $10::uuid, $11)
           ON CONFLICT (event_id) DO NOTHING
           RETURNING event_id`,
          [event.eventId, event.sessionId, event.sequenceNumber, event.eventType, event.keyCode, event.timestamp, event.dwellTimeMs ?? null, event.interKeyLatencyMs ?? null, event.isCorrection, event.deviceId ?? null, event.signatureVerified ?? false],
        );
        if ((result.rowCount ?? 0) > 0) accepted += 1;
        else replayed += 1;
      }
      return { accepted, replayed };
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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext('aegiskey-audit-chain'))");
        const previous = await client.query<{ entryHash: string | null }>(`SELECT entry_hash AS "entryHash" FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 1`);
        const previousHash = previous.rows[0]?.entryHash ?? "GENESIS";
        const id = event.id ?? randomUUID();
        const metadata = event.metadata ?? {};
        const entryHash = auditEntryHash(previousHash, { actorId: event.actorId, action: event.action, timestamp: event.timestamp, result: event.result, metadata });
        await client.query(`INSERT INTO audit_logs (id, actor_id, action, result, metadata, created_at, audit_timestamp_ms, previous_hash, entry_hash, hash_algorithm) SELECT $1::uuid, id, $2, $3, $4::jsonb, to_timestamp($5 / 1000.0), $5, $6, $7, 'sha256' FROM users WHERE email = $8`, [id, event.action, event.result, JSON.stringify(metadata), event.timestamp, previousHash, entryHash, event.actorId]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },
    async listRecent(limit: number) {
      const result = await pool.query<AuditEvent>(`SELECT l.id, COALESCE(u.email, 'system') AS "actorId", action, result, COALESCE(audit_timestamp_ms, round(EXTRACT(EPOCH FROM created_at) * 1000)::bigint) AS timestamp, metadata, previous_hash AS "previousHash", entry_hash AS "entryHash", hash_algorithm AS "hashAlgorithm" FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_id ORDER BY created_at DESC, id DESC LIMIT $1`, [limit]);
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
  alerts: {
    async create(alert: SecurityAlert) {
      await pool.query(`INSERT INTO security_alerts (id, user_id, session_id, severity, title, explanation, status, created_at, resolved_at) SELECT $1::uuid, u.id, $2::uuid, $3, $4, $5, $6, to_timestamp($7 / 1000.0), CASE WHEN $8::bigint IS NULL THEN NULL ELSE to_timestamp($8 / 1000.0) END FROM users u WHERE u.email = $9`, [alert.id, alert.sessionId, alert.severity, alert.title, alert.explanation, alert.status, alert.createdAt, alert.resolvedAt ?? null, alert.userId]);
    },
    async listOpen(userId: string, limit: number) {
      const result = await pool.query<SecurityAlert>(`SELECT a.id, u.email AS "userId", a.session_id AS "sessionId", a.severity, a.title, a.explanation, a.status, EXTRACT(EPOCH FROM a.created_at) * 1000 AS "createdAt", EXTRACT(EPOCH FROM a.resolved_at) * 1000 AS "resolvedAt" FROM security_alerts a JOIN users u ON u.id = a.user_id WHERE u.email = $1 AND a.status = 'OPEN' ORDER BY a.created_at DESC LIMIT $2`, [userId, limit]);
      return result.rows;
    },
  },
  devices: {
    async register(userId: string, registration: DeviceRegistration) {
      const result = await pool.query<EnrolledDevice>(`INSERT INTO devices (user_id, name, algorithm, public_key) SELECT id, $2, $3, $4 FROM users WHERE email = $1 RETURNING id, user_id AS "userId", name, algorithm, public_key AS "publicKey", EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt", EXTRACT(EPOCH FROM last_seen_at) * 1000 AS "lastSeenAt", EXTRACT(EPOCH FROM revoked_at) * 1000 AS "revokedAt"`, [userId, registration.name, registration.algorithm, registration.publicKey]);
      if (!result.rows[0]) throw new Error("ACCOUNT_NOT_FOUND");
      return mapDevice(result.rows[0]);
    },
    async listForUser(userId: string) {
      const result = await pool.query<EnrolledDevice>(`SELECT d.id, u.email AS "userId", d.name, d.algorithm, d.public_key AS "publicKey", EXTRACT(EPOCH FROM d.created_at) * 1000 AS "createdAt", EXTRACT(EPOCH FROM d.last_seen_at) * 1000 AS "lastSeenAt", EXTRACT(EPOCH FROM d.revoked_at) * 1000 AS "revokedAt" FROM devices d JOIN users u ON u.id = d.user_id WHERE u.email = $1 ORDER BY d.created_at DESC`, [userId]);
      return result.rows.map(mapDevice);
    },
    async getOwned(userId: string, deviceId: string) {
      const result = await pool.query<EnrolledDevice>(`SELECT d.id, u.email AS "userId", d.name, d.algorithm, d.public_key AS "publicKey", EXTRACT(EPOCH FROM d.created_at) * 1000 AS "createdAt", EXTRACT(EPOCH FROM d.last_seen_at) * 1000 AS "lastSeenAt", EXTRACT(EPOCH FROM d.revoked_at) * 1000 AS "revokedAt" FROM devices d JOIN users u ON u.id = d.user_id WHERE u.email = $1 AND d.id = $2::uuid AND d.revoked_at IS NULL`, [userId, deviceId]);
      return result.rows[0] ? mapDevice(result.rows[0]) : null;
    },
    async revoke(userId: string, deviceId: string) {
      const result = await pool.query(`UPDATE devices d SET revoked_at = now() FROM users u WHERE d.user_id = u.id AND u.email = $1 AND d.id = $2::uuid AND d.revoked_at IS NULL`, [userId, deviceId]);
      return (result.rowCount ?? 0) > 0;
    },
    async markSeen(deviceId: string) { await pool.query(`UPDATE devices SET last_seen_at = now() WHERE id = $1::uuid AND revoked_at IS NULL`, [deviceId]); },
  },
  auditIntegrity: {
    async verify(): Promise<AuditIntegrityResult> {
      const result = await pool.query<{ id: string; previousHash: string | null; entryHash: string | null; actorId: string; action: string; timestamp: number; result: string; metadata: Record<string, string | number | boolean> }>(`SELECT l.id, l.previous_hash AS "previousHash", l.entry_hash AS "entryHash", COALESCE(u.email, 'system') AS "actorId", l.action, COALESCE(l.audit_timestamp_ms, round(EXTRACT(EPOCH FROM l.created_at) * 1000)::bigint) AS timestamp, l.result, l.metadata FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_id ORDER BY l.created_at ASC, l.id ASC`);
      let previousHash = "GENESIS";
      for (let index = 0; index < result.rows.length; index += 1) {
        const row = result.rows[index];
        if (!row.previousHash && row.entryHash) { previousHash = row.entryHash; continue; }
        const expected = auditEntryHash(row.previousHash ?? previousHash, { actorId: row.actorId, action: row.action, timestamp: Number(row.timestamp), result: row.result, metadata: row.metadata ?? {} });
        if (!row.previousHash || row.previousHash !== previousHash || row.entryHash !== expected) return { valid: false, checked: index, firstInvalidId: row.id, reason: "AUDIT_HASH_MISMATCH" };
        previousHash = row.entryHash;
      }
      return { valid: true, checked: result.rows.length };
    },
  },
};
