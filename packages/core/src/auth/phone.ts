/**
 * Validasi dan Identifikasi Operator Nomor Telepon Seluler Indonesia.
 * Sesuai regulasi prefix operator telekomunikasi seluler di Indonesia.
 */

export interface IndonesianPhoneInfo {
  valid: boolean;
  normalized?: string;
  operator?: string;
  brand?: string;
  error?: string;
}

export interface OperatorPrefixRule {
  prefix: string;
  operator: string;
  brand: string;
}

export const INDONESIAN_OPERATOR_PREFIXES: readonly OperatorPrefixRule[] = [
  // 1. Telkomsel (simPATI, Kartu Halo, By.U, Telkomsel PraBayar)
  { prefix: "0811", operator: "Telkomsel", brand: "Kartu Halo" },
  { prefix: "0812", operator: "Telkomsel", brand: "Kartu Halo / simPATI" },
  { prefix: "0813", operator: "Telkomsel", brand: "Kartu Halo / simPATI" },
  { prefix: "0821", operator: "Telkomsel", brand: "simPATI" },
  { prefix: "0822", operator: "Telkomsel", brand: "simPATI / Kartu As" },
  { prefix: "0823", operator: "Telkomsel", brand: "Kartu As" },
  { prefix: "0851", operator: "Telkomsel", brand: "By.U / Kartu As" },
  { prefix: "0852", operator: "Telkomsel", brand: "Kartu As" },
  { prefix: "0853", operator: "Telkomsel", brand: "Kartu As" },

  // 2. Indosat Ooredoo Hutchison (IM3 & Tri)
  { prefix: "0814", operator: "Indosat Ooredoo Hutchison", brand: "Indosat / Matrix" },
  { prefix: "0815", operator: "Indosat Ooredoo Hutchison", brand: "Indosat / Matrix / Mentari" },
  { prefix: "0816", operator: "Indosat Ooredoo Hutchison", brand: "Indosat / Matrix / Mentari" },
  { prefix: "0855", operator: "Indosat Ooredoo Hutchison", brand: "Indosat / Matrix" },
  { prefix: "0856", operator: "Indosat Ooredoo Hutchison", brand: "IM3" },
  { prefix: "0857", operator: "Indosat Ooredoo Hutchison", brand: "IM3" },
  { prefix: "0858", operator: "Indosat Ooredoo Hutchison", brand: "Mentari / IM3" },
  { prefix: "0895", operator: "Indosat Ooredoo Hutchison", brand: "Tri (3)" },
  { prefix: "0896", operator: "Indosat Ooredoo Hutchison", brand: "Tri (3)" },
  { prefix: "0897", operator: "Indosat Ooredoo Hutchison", brand: "Tri (3)" },
  { prefix: "0898", operator: "Indosat Ooredoo Hutchison", brand: "Tri (3)" },
  { prefix: "0899", operator: "Indosat Ooredoo Hutchison", brand: "Tri (3)" },

  // 3. XL Axiata (XL & Axis)
  { prefix: "0817", operator: "XL Axiata", brand: "XL" },
  { prefix: "0818", operator: "XL Axiata", brand: "XL" },
  { prefix: "0819", operator: "XL Axiata", brand: "XL" },
  { prefix: "0859", operator: "XL Axiata", brand: "XL" },
  { prefix: "0877", operator: "XL Axiata", brand: "XL" },
  { prefix: "0878", operator: "XL Axiata", brand: "XL" },
  { prefix: "0831", operator: "XL Axiata", brand: "Axis" },
  { prefix: "0832", operator: "XL Axiata", brand: "Axis" },
  { prefix: "0833", operator: "XL Axiata", brand: "Axis" },
  { prefix: "0838", operator: "XL Axiata", brand: "Axis" },

  // 4. Smartfren
  { prefix: "0881", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0882", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0883", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0884", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0885", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0886", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0887", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0888", operator: "Smartfren", brand: "Smartfren" },
  { prefix: "0889", operator: "Smartfren", brand: "Smartfren" },
] as const;

const PREFIX_MAP = new Map<string, { operator: string; brand: string }>(
  INDONESIAN_OPERATOR_PREFIXES.map((item) => [item.prefix, { operator: item.operator, brand: item.brand }])
);

/**
 * Menormalkan input nomor telepon ke format standar Indonesia (08...).
 */
export function normalizeIndonesianPhoneNumber(raw: string): string {
  let cleaned = raw.trim().replace(/[\s\-_().]/g, "");

  if (cleaned.startsWith("+62")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("62") && cleaned.length >= 10) {
    cleaned = "0" + cleaned.slice(2);
  }

  return cleaned;
}

/**
 * Mengidentifikasi info operator seluler Indonesia berdasarkan prefix 4 digit awal.
 */
export function getIndonesianPhoneOperator(phone: string): { operator: string; brand: string } | null {
  const normalized = normalizeIndonesianPhoneNumber(phone);
  if (normalized.length < 4) return null;
  const prefix = normalized.slice(0, 4);
  return PREFIX_MAP.get(prefix) ?? null;
}

/**
 * Validasi ketat nomor telepon seluler Indonesia:
 * - Harus dimulai dengan 08 (atau +628 / 628)
 * - Panjang digit antara 10 hingga 14 karakter
 * - Prefix 4 digit harus terdaftar pada salah satu operator resmi (Telkomsel, Indosat Ooredoo, XL Axiata, Smartfren)
 */
export function validateIndonesianPhoneNumber(raw: unknown): IndonesianPhoneInfo {
  if (typeof raw !== "string" || !raw.trim()) {
    return {
      valid: false,
      error: "Nomor telepon wajib diisi.",
    };
  }

  const normalized = normalizeIndonesianPhoneNumber(raw);

  if (!/^\d+$/.test(normalized)) {
    return {
      valid: false,
      error: "Nomor telepon hanya boleh berisi angka.",
    };
  }

  if (!normalized.startsWith("08")) {
    return {
      valid: false,
      error: "Nomor telepon Indonesia harus diawali dengan 08 (atau +628).",
    };
  }

  if (normalized.length < 10) {
    return {
      valid: false,
      error: "Nomor telepon terlalu pendek (minimal 10 digit).",
    };
  }

  if (normalized.length > 14) {
    return {
      valid: false,
      error: "Nomor telepon terlalu panjang (maksimal 14 digit).",
    };
  }

  const prefix = normalized.slice(0, 4);
  const operatorInfo = PREFIX_MAP.get(prefix);

  if (!operatorInfo) {
    return {
      valid: false,
      error: `Prefix nomor telepon '${prefix}' bukan prefix operator seluler Indonesia yang valid.`,
    };
  }

  return {
    valid: true,
    normalized,
    operator: operatorInfo.operator,
    brand: operatorInfo.brand,
  };
}
