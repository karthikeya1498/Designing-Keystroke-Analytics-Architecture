export type UserRole = "USER" | "ANALYST" | "ADMIN";
export type EventType = "key_press" | "key_release" | "session_summary";

/** Raw key values are intentionally absent from every server-side contract. */
export interface SanitizedKeystrokeEvent {
  eventId: string;
  sessionId: string;
  sequenceNumber: number;
  eventType: EventType;
  keyCode: string;
  timestamp: number;
  dwellTimeMs?: number;
  interKeyLatencyMs?: number;
  isCorrection: boolean;
}

export interface SessionSummary {
  sessionId: string;
  userId: string;
  startedAt: number;
  endedAt: number;
  keyCount: number;
  backspaceCount: number;
  correctionCount: number;
  meanInterKeyMs: number | null;
  p95InterKeyMs: number | null;
  meanDwellMs: number | null;
  p95DwellMs: number | null;
  estimatedWpm: number;
  errorRate: number;
}

export interface AnalyticsSnapshot extends SessionSummary {
  characterCount?: number;
  durationSeconds?: number;
  medianDwellMs?: number | null;
  medianInterKeyMs?: number | null;
  pauseCount?: number;
  fatigueScore?: number;
  anomalyScore: number | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "BASELINE_BUILDING";
}

export interface AuditEvent {
  actorId: string;
  action: "LOGIN" | "LOGOUT" | "SESSION_CREATED" | "ANOMALY_DETECTED" | "ALERT_CREATED" | "ADMIN_CONFIG_CHANGED";
  timestamp: number;
  result: "SUCCESS" | "DENIED" | "FAILED";
  metadata?: Record<string, string | number | boolean>;
}
