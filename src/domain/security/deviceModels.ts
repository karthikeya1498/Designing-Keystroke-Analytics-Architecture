export type DeviceAlgorithm = "Ed25519";

/** Author: Karthikeya. Public keys are safe to persist; private keys never enter the server. */
export interface EnrolledDevice {
  id: string;
  userId: string;
  name: string;
  algorithm: DeviceAlgorithm;
  publicKey: string;
  createdAt: number;
  lastSeenAt?: number;
  revokedAt?: number;
}

export interface DeviceRegistration {
  name: string;
  algorithm: DeviceAlgorithm;
  publicKey: string;
}

export interface SignedTelemetryEnvelope {
  deviceId: string;
  signature: string;
  payload: string;
}

export interface AuditIntegrityResult {
  valid: boolean;
  checked: number;
  firstInvalidId?: string;
  reason?: string;
}
