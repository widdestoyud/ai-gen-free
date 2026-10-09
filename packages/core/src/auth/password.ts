import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Memeriksa apakah sebuah string merupakan hash SHA-256 berformat 64 karakter heksadesimal.
 */
export function isSha256Hex(str: unknown): boolean {
  return typeof str === "string" && /^[a-f0-9]{64}$/i.test(str);
}

/**
 * Validasi password:
 * - Minimal 8 karakter
 * - Setidaknya 1 huruf kapital dan 1 angka
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
 * Secara otomatis menormalisasi plaintext menjadi pre-hash SHA-256 jika belum berformat SHA-256 hex.
 * Format: salt:hash
 */
export async function hashPassword(password: string): Promise<string> {
  const normalized = isSha256Hex(password) ? password : createHash("sha256").update(password).digest("hex");
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(normalized, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifikasi password terhadap hash scrypt tersimpan.
 * Mendukung verifikasi langsung dan verifikasi pre-hash SHA-256.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  try {
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const keyBuffer = Buffer.from(key, "hex");
    if (derivedKey.length === keyBuffer.length && timingSafeEqual(derivedKey, keyBuffer)) {
      return true;
    }
    // Jika tidak cocok dan input belum berupa SHA-256 hex, coba verifikasi terhadap SHA-256-nya
    if (!isSha256Hex(password)) {
      const sha = createHash("sha256").update(password).digest("hex");
      const derivedShaKey = (await scryptAsync(sha, salt, 64)) as Buffer;
      if (derivedShaKey.length === keyBuffer.length && timingSafeEqual(derivedShaKey, keyBuffer)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
