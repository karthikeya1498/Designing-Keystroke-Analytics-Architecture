import type { AnalyticsSnapshot, AuditEvent, SanitizedKeystrokeEvent, SessionSummary } from "@/domain/events/models";
import type { AnomalyAssessment, BehavioralBaseline } from "@/domain/security/models";

export interface EventAppendResult {
  accepted: number;
  replayed: number;
}

export interface EventRepository {
  ensureSession(sessionId: string, userId: string, startedAt: number, endedAt: number): Promise<void>;
  appendEvents(events: readonly SanitizedKeystrokeEvent[]): Promise<EventAppendResult>;
  getLatestEvents(limit: number): Promise<readonly SanitizedKeystrokeEvent[]>;
}

export interface AnalyticsRepository {
  saveSnapshot(snapshot: AnalyticsSnapshot): Promise<void>;
  getSessionSummary(sessionId: string): Promise<SessionSummary | null>;
}

export interface AuditRepository {
  append(event: AuditEvent): Promise<void>;
  listRecent(limit: number): Promise<readonly AuditEvent[]>;
}

export interface BaselineRepository {
  save(baseline: BehavioralBaseline): Promise<void>;
  get(userId: string): Promise<BehavioralBaseline | null>;
}

export interface AnomalyRepository {
  append(assessment: AnomalyAssessment): Promise<void>;
  listRecent(userId: string, limit: number): Promise<readonly AnomalyAssessment[]>;
}

export interface StoragePort {
  events: EventRepository;
  analytics: AnalyticsRepository;
  audit: AuditRepository;
  baselines: BaselineRepository;
  anomalies: AnomalyRepository;
}
