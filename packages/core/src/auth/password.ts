import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Validasi password:
 * - Minimal 8 karakter
 * - Setidaknya 1 huruf kapital
 * - Setidaknya 1 angka
 */
export function validatePassword(password: unknown): { valid: boolean; message?: string } {
  if (typeof password !== "string" || password.length < 8) {
    return { valid: false, message: "Kata sandi minimal 8 karakter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Kata sandi harus mengandung setidaknya 1 huruf kapital" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Kata sandi harus mengandung setidaknya 1 angka" };
  }
  return { valid: true };
}

/**
 * Hash password menggunakan scrypt dengan random salt 16-byte.
 * Format: salt:hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifikasi password terhadap hash scrypt tersimpan.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  try {
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const keyBuffer = Buffer.from(key, "hex");
    if (derivedKey.length !== keyBuffer.length) return false;
    return timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}
