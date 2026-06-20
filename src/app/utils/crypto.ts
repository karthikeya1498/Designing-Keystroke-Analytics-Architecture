/**
 * Web Crypto API AES-GCM 256-bit Encryption helper for simulated local agent.
 */

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
  return cachedKey;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  keyHex: string;
}

export async function encryptEvent(payload: any): Promise<EncryptedPayload> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    // Server-side rendering fallback
    return {
      ciphertext: "4f82d3e91a2bc8f47e6d",
      iv: "1234567890abcdef12345678",
      keyHex: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    };
  }

  try {
    const key = await getKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    
    // Generate a random 12-byte initialization vector (IV) for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      data
    );

    const ciphertextBuffer = new Uint8Array(encrypted);
    const ciphertextHex = Array.from(ciphertextBuffer)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
      
    const ivHex = Array.from(iv)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
      
    // Export raw key bytes to display in the dashboard logs
    const exportedKey = await window.crypto.subtle.exportKey("raw", key);
    const keyHex = Array.from(new Uint8Array(exportedKey))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      ciphertext: ciphertextHex,
      iv: ivHex,
      keyHex: keyHex,
    };
  } catch (err) {
    console.error("Encryption failed:", err);
    return {
      ciphertext: "ENCRYPTION_ERROR",
      iv: "000000000000000000000000",
      keyHex: "0000000000000000000000000000000000000000000000000000000000000000",
    };
  }
}
