import { createPublicKey, verify } from "node:crypto";

const MAX_SIGNED_PAYLOAD_BYTES = 64 * 1024;

export function decodeSignedPayload(payload: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  const bytes = Buffer.from(payload, "base64url");
  return bytes.length > 0 && bytes.length <= MAX_SIGNED_PAYLOAD_BYTES ? bytes : null;
}

export function verifyEd25519Signature(publicKey: string, payload: Buffer, signature: string): boolean {
  if (!publicKey.startsWith("-----BEGIN PUBLIC KEY-----") || publicKey.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(signature)) return false;
  try {
    const key = createPublicKey(publicKey);
    return key.asymmetricKeyType === "ed25519" && verify(null, payload, key, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}
