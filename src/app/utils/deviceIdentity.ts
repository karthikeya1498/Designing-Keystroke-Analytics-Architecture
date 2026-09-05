const DB_NAME = "aegiskey-device-identity";
const STORE_NAME = "keys";
const KEY_NAME = "default";

interface StoredIdentity {
  privateKey: CryptoKey;
  publicKeyPem: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readIdentity(): Promise<StoredIdentity | undefined> {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(KEY_NAME);
    request.onsuccess = () => resolve(request.result as StoredIdentity | undefined);
    request.onerror = () => reject(request.error);
  }));
}

function saveIdentity(identity: StoredIdentity): Promise<void> {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(identity, KEY_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
}

function toBase64(bytes: ArrayBuffer): string { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function toBase64Url(bytes: ArrayBuffer): string { return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function pem(bytes: ArrayBuffer): string { const encoded = toBase64(bytes); return `-----BEGIN PUBLIC KEY-----\n${encoded.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`; }

export async function getOrCreateDeviceIdentity(): Promise<StoredIdentity> {
  const existing = await readIdentity();
  if (existing) return existing;
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  const identity = { privateKey: pair.privateKey, publicKeyPem: pem(await crypto.subtle.exportKey("spki", pair.publicKey)) };
  await saveIdentity(identity);
  return identity;
}

export async function signTelemetryPayload(payload: string): Promise<{ payload: string; signature: string }> {
  const identity = await getOrCreateDeviceIdentity();
  const encoded = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, identity.privateKey, encoded);
  return { payload: toBase64Url(encoded.buffer), signature: toBase64Url(signature) };
}

export async function getPublicDeviceKey(): Promise<string> { return (await getOrCreateDeviceIdentity()).publicKeyPem; }
