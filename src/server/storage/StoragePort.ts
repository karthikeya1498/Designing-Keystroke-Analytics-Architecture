import type { AnalyticsSnapshot, AuditEvent, SanitizedKeystrokeEvent, SessionSummary } from "@/domain/events/models";

export interface EventRepository {
  appendEvents(events: readonly SanitizedKeystrokeEvent[]): Promise<void>;
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

export interface StoragePort {
  events: EventRepository;
  analytics: AnalyticsRepository;
  audit: AuditRepository;
}
