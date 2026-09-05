import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeSignedPayload, verifyEd25519Signature } from "../../src/server/deviceSignature";

describe("device signatures", () => {
  it("verifies an Ed25519 signature over a bounded payload", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const payload = Buffer.from("{\"events\":[]}");
    const signature = sign(null, payload, privateKey).toString("base64url");
    expect(verifyEd25519Signature(publicKeyPem, payload, signature)).toBe(true);
    expect(verifyEd25519Signature(publicKeyPem, Buffer.from("tampered"), signature)).toBe(false);
  });

  it("rejects malformed or oversized payload encodings", () => {
    expect(decodeSignedPayload("not base64!")).toBeNull();
    expect(decodeSignedPayload("")).toBeNull();
  });
});
