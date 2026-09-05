import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 12;

let pool: Pool | undefined;

function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 3_000, statement_timeout: 5_000, application_name: "aegiskey-auth" });
  return pool;
}

export function validatePasswordPolicy(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= 200 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION, maxmem: 128 * SCRYPT_COST * SCRYPT_BLOCK_SIZE + 1024 * 1024 });
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, cost, blockSize, parallelization, saltValue, digestValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !saltValue || !digestValue) return false;
  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(digestValue, "base64url");
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
  try {
    const actual = scryptSync(password, salt, expected.length, { N: Number(cost), r: Number(blockSize), p: Number(parallelization), maxmem: 128 * Number(cost) * Number(blockSize) + 1024 * 1024 });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createAccount(email: string, password: string): Promise<{ id: string; email: string }> {
  const result = await getPool().query<{ id: string; email: string }>("INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email", [email, hashPassword(password)]);
  return result.rows[0];
}

export type AccountRole = "USER" | "ANALYST" | "ADMIN";

export async function getAccountRole(email: string): Promise<AccountRole | null> {
  const result = await getPool().query<{ role: AccountRole }>("SELECT role FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);
  return result.rows[0]?.role ?? null;
}

export async function authenticateAccount(email: string, password: string): Promise<{ id: string; email: string } | null> {
  const result = await getPool().query<{ id: string; email: string; password_hash: string }>("SELECT id, email, password_hash FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);
  const account = result.rows[0];
  if (!account || !verifyPassword(password, account.password_hash)) return null;
  return { id: account.id, email: account.email };
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}
