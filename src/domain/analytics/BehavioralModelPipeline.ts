import type { SanitizedKeystrokeEvent } from "../events/models";
import { extractBehavioralFeatures, type BehavioralFeatureVector } from "./FeatureExtractor";

export class BehavioralModelPipeline {
  private readonly events = new Map<number, SanitizedKeystrokeEvent>();

  constructor(
    readonly sessionId: string,
    readonly userId: string,
  ) {}

  ingest(event: SanitizedKeystrokeEvent): void {
    if (event.sessionId !== this.sessionId) throw new Error("Event session does not match pipeline session");
    if (this.events.has(event.sequenceNumber)) throw new Error("Duplicate sequence number");
    this.events.set(event.sequenceNumber, event);
  }

  ingestBatch(events: readonly SanitizedKeystrokeEvent[]): void {
    for (const event of events) this.ingest(event);
  }

  snapshot(): BehavioralFeatureVector | null {
    if (this.events.size === 0) return null;
    return extractBehavioralFeatures([...this.events.values()], this.userId);
  }

  size(): number {
    return this.events.size;
  }
}
