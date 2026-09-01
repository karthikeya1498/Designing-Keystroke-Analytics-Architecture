import type { EventType, SanitizedKeystrokeEvent } from "./models";

export interface CollectorInput {
  keyCode: string;
  timestamp: number;
  isCorrection?: boolean;
}

export class SanitizedTelemetryCollector {
  readonly sessionId: string;
  private sequenceNumber = 0;
  private readonly pressedAt = new Map<string, number>();
  private previousKeyUpAt: number | null = null;

  constructor(sessionId = crypto.randomUUID()) {
    this.sessionId = sessionId;
  }

  private createEvent(input: CollectorInput, eventType: EventType, extras: Pick<SanitizedKeystrokeEvent, "dwellTimeMs" | "interKeyLatencyMs"> = {}): SanitizedKeystrokeEvent {
    this.sequenceNumber += 1;
    return {
      eventId: crypto.randomUUID(),
      sessionId: this.sessionId,
      sequenceNumber: this.sequenceNumber,
      eventType,
      keyCode: input.keyCode,
      timestamp: input.timestamp,
      isCorrection: input.isCorrection ?? false,
      ...extras,
    };
  }

  keyDown(input: CollectorInput): SanitizedKeystrokeEvent | null {
    if (this.pressedAt.has(input.keyCode)) return null;
    this.pressedAt.set(input.keyCode, input.timestamp);
    const interKeyLatencyMs = this.previousKeyUpAt === null ? undefined : Math.max(0, input.timestamp - this.previousKeyUpAt);
    return this.createEvent(input, "key_press", { interKeyLatencyMs });
  }

  keyUp(input: CollectorInput): SanitizedKeystrokeEvent | null {
    const keyDownAt = this.pressedAt.get(input.keyCode);
    if (keyDownAt === undefined) return null;
    this.pressedAt.delete(input.keyCode);
    this.previousKeyUpAt = input.timestamp;
    return this.createEvent(input, "key_release", { dwellTimeMs: Math.max(0, input.timestamp - keyDownAt) });
  }

  reset(): void {
    this.pressedAt.clear();
    this.previousKeyUpAt = null;
    this.sequenceNumber = 0;
  }
}
