import type { AnalyticsSnapshot, AuditEvent, SanitizedKeystrokeEvent, SessionSummary } from "@/domain/events/models";
import type { AnomalyAssessment, BehavioralBaseline, SecurityAlert } from "@/domain/security/models";
import type { AuditIntegrityResult, DeviceRegistration, EnrolledDevice } from "@/domain/security/deviceModels";

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

export interface AlertRepository {
  create(alert: SecurityAlert): Promise<void>;
  listOpen(userId: string, limit: number): Promise<readonly SecurityAlert[]>;
}

export interface DeviceRepository {
  register(userId: string, registration: DeviceRegistration): Promise<EnrolledDevice>;
  listForUser(userId: string): Promise<readonly EnrolledDevice[]>;
  getOwned(userId: string, deviceId: string): Promise<EnrolledDevice | null>;
  revoke(userId: string, deviceId: string): Promise<boolean>;
  markSeen(deviceId: string): Promise<void>;
}

export interface AuditIntegrityRepository {
  verify(): Promise<AuditIntegrityResult>;
}

export interface StoragePort {
  events: EventRepository;
  analytics: AnalyticsRepository;
  audit: AuditRepository;
  baselines: BaselineRepository;
  anomalies: AnomalyRepository;
  alerts: AlertRepository;
  devices: DeviceRepository;
  auditIntegrity: AuditIntegrityRepository;
}
