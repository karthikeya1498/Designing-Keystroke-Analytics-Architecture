/**
 * Browser-side encryption for the demo agent.
 *
 * The AES key is deliberately non-extractable and is never returned, logged, or
 * sent with the event. This protects the demo from the original
 * "ciphertext + key" design error. Production agents should use a device key
 * protected by the platform keystore and rotate it through a KMS-backed flow.
 */

let cachedKey: CryptoKey | null = null;

type SerializablePayload = Record<string, string | number | boolean | null>;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable outside a secure browser context");
  }

  cachedKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  return cachedKey;
}

export interface EncryptedPayload {
  algorithm: "AES-256-GCM";
  ciphertext: string;
  iv: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function encryptEvent(payload: SerializablePayload): Promise<EncryptedPayload> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Cannot encrypt keystroke events during server-side rendering");
  }

  const key = await getKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return {
    algorithm: "AES-256-GCM",
    ciphertext: bytesToHex(new Uint8Array(encrypted)),
    iv: bytesToHex(iv),
  };
}
