import { mkdir, appendFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnalyticsSnapshot, AuditEvent, SanitizedKeystrokeEvent, SessionSummary } from "@/domain/events/models";
import type { AnomalyAssessment, BehavioralBaseline, SecurityAlert } from "@/domain/security/models";
import type { StoragePort } from "./StoragePort";

const dataDirectory = path.join(process.cwd(), "data");
const eventsPath = path.join(dataDirectory, "keystroke_events.jsonl");
const snapshotsPath = path.join(dataDirectory, "analytics_snapshots.jsonl");
const auditPath = path.join(dataDirectory, "audit_events.jsonl");
const baselinesPath = path.join(dataDirectory, "baselines.json");
const anomaliesPath = path.join(dataDirectory, "anomaly_assessments.jsonl");
const alertsPath = path.join(dataDirectory, "security_alerts.jsonl");

async function ensureDataDirectory(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
}

async function appendJson(pathname: string, value: unknown): Promise<void> {
  await ensureDataDirectory();
  await appendFile(pathname, `${JSON.stringify(value)}\n`, "utf8");
}

async function readJsonLines<T>(pathname: string): Promise<T[]> {
  try {
    const content = await readFile(pathname, "utf8");
    return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readBaselines(): Promise<Record<string, BehavioralBaseline>> {
  try {
    return JSON.parse(await readFile(baselinesPath, "utf8")) as Record<string, BehavioralBaseline>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export const fileStorage: StoragePort = {
  events: {
    async ensureSession() {
      // File mode has no relational session table; analytics still binds the user.
    },
    async appendEvents(events: readonly SanitizedKeystrokeEvent[]) {
      const existing = new Set((await readJsonLines<SanitizedKeystrokeEvent>(eventsPath)).map((event) => `${event.sessionId}:${event.sequenceNumber}`));
      let accepted = 0;
      let replayed = 0;
      for (const event of events) {
        const key = `${event.sessionId}:${event.sequenceNumber}`;
        if (existing.has(key)) { replayed += 1; continue; }
        await appendJson(eventsPath, event);
        existing.add(key);
        accepted += 1;
      }
      return { accepted, replayed };
    },
    async getLatestEvents(limit: number) {
      const events = await readJsonLines<SanitizedKeystrokeEvent>(eventsPath);
      return events.slice(-Math.max(0, limit)).reverse();
    },
  },
  analytics: {
    async saveSnapshot(snapshot: AnalyticsSnapshot) { await appendJson(snapshotsPath, snapshot); },
    async getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
      const snapshots = await readJsonLines<AnalyticsSnapshot>(snapshotsPath);
      return snapshots.findLast((snapshot) => snapshot.sessionId === sessionId) ?? null;
    },
  },
  audit: {
    async append(event: AuditEvent) { await appendJson(auditPath, event); },
    async listRecent(limit: number) {
      const events = await readJsonLines<AuditEvent>(auditPath);
      return events.slice(-Math.max(0, limit)).reverse();
    },
  },
  baselines: {
    async save(baseline: BehavioralBaseline) {
      const baselines = await readBaselines();
      baselines[baseline.userId] = baseline;
      await ensureDataDirectory();
      const temporaryPath = `${baselinesPath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(baselines, null, 2), "utf8");
      await rename(temporaryPath, baselinesPath);
    },
    async get(userId: string) {
      const baselines = await readBaselines();
      return baselines[userId] ?? null;
    },
  },
  anomalies: {
    async append(assessment: AnomalyAssessment) { await appendJson(anomaliesPath, assessment); },
    async listRecent(userId: string, limit: number) {
      const assessments = await readJsonLines<AnomalyAssessment>(anomaliesPath);
      return assessments.filter((assessment) => assessment.userId === userId).slice(-Math.max(0, limit)).reverse();
    },
  },
  alerts: {
    async create(alert: SecurityAlert) { await appendJson(alertsPath, alert); },
    async listOpen(userId: string, limit: number) {
      const alerts = await readJsonLines<SecurityAlert>(alertsPath);
      return alerts.filter((alert) => alert.userId === userId && alert.status === "OPEN").slice(-Math.max(0, limit)).reverse();
    },
  },
};
