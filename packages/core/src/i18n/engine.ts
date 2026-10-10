import {
  DEFAULT_LOCALE,
  type I18nBackendPort,
  type I18nTranslator,
  type Locale,
  SUPPORTED_LOCALES,
  type TranslationParams,
} from "./port.js";
import idDict from "./locales/id.json" with { type: "json" };
import enDict from "./locales/en.json" with { type: "json" };

const DICTIONARIES: Record<Locale, Record<string, unknown>> = {
  id: idDict as Record<string, unknown>,
  en: enDict as Record<string, unknown>,
};

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (key in params && params[key] !== undefined && params[key] !== null) {
      return String(params[key]);
    }
    return match;
  });
}

export class JsonDictionaryI18nEngine implements I18nBackendPort {
  private readonly dictionaries: Record<Locale, Record<string, unknown>>;

  constructor(customDicts?: Partial<Record<Locale, Record<string, unknown>>>) {
    this.dictionaries = {
      id: customDicts?.id ? { ...DICTIONARIES.id, ...customDicts.id } : DICTIONARIES.id,
      en: customDicts?.en ? { ...DICTIONARIES.en, ...customDicts.en } : DICTIONARIES.en,
    };
  }

  resolveLocale(headers?: Record<string, string | string[] | undefined | null>): Locale {
    if (!headers) return DEFAULT_LOCALE;

    // 1. Explicit x-locale header (forwarded from Next.js BFF)
    const xLocale = headers["x-locale"] || headers["X-Locale"];
    const candidateLocale = Array.isArray(xLocale) ? xLocale[0] : xLocale;
    if (candidateLocale) {
      const clean = candidateLocale.trim().toLowerCase();
      if (SUPPORTED_LOCALES.includes(clean as Locale)) {
        return clean as Locale;
      }
    }

    // 2. Accept-Language header
    const acceptLang = headers["accept-language"] || headers["Accept-Language"];
    const rawAccept = Array.isArray(acceptLang) ? acceptLang[0] : acceptLang;
    if (rawAccept) {
      const lower = rawAccept.toLowerCase();
      if (lower.startsWith("id") || lower.includes("id-id") || lower.includes("in-id")) {
        return "id";
      }
      if (lower.startsWith("en") || lower.includes("en-us") || lower.includes("en-gb")) {
        return "en";
      }
      // Any other non-Indonesian language header (ja, ms, zh, etc.) defaults to en
      return "en";
    }

    // 3. Cloudflare GeoIP header (cf-ipcountry)
    const country = headers["cf-ipcountry"] || headers["CF-IPCountry"];
    const rawCountry = Array.isArray(country) ? country[0] : country;
    if (rawCountry) {
      const upper = rawCountry.trim().toUpperCase();
      if (upper === "ID") return "id";
      return "en";
    }

    return DEFAULT_LOCALE;
  }

  translate(key: string, locale?: string | null, params?: TranslationParams): string {
    const validLocale: Locale = locale && SUPPORTED_LOCALES.includes(locale.toLowerCase() as Locale)
      ? (locale.toLowerCase() as Locale)
      : DEFAULT_LOCALE;

    // Lookup in target locale
    let text = getNestedValue(this.dictionaries[validLocale], key);

    // Fallback to default locale if missing
    if (!text && validLocale !== DEFAULT_LOCALE) {
      text = getNestedValue(this.dictionaries[DEFAULT_LOCALE], key);
    }

    // Fallback to raw key if missing in all dictionaries
    if (!text) {
      return key;
    }

    return interpolate(text, params);
  }

  has(key: string, locale?: string | null): boolean {
    const validLocale: Locale = locale && SUPPORTED_LOCALES.includes(locale.toLowerCase() as Locale)
      ? (locale.toLowerCase() as Locale)
      : DEFAULT_LOCALE;

    return getNestedValue(this.dictionaries[validLocale], key) !== undefined ||
      getNestedValue(this.dictionaries[DEFAULT_LOCALE], key) !== undefined;
  }

  getTranslator(locale?: string | null, namespace?: string): I18nTranslator {
    const validLocale: Locale = locale && SUPPORTED_LOCALES.includes(locale.toLowerCase() as Locale)
      ? (locale.toLowerCase() as Locale)
      : DEFAULT_LOCALE;

    const translator: I18nTranslator = (key: string, params?: TranslationParams) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return this.translate(fullKey, validLocale, params);
    };

    translator.has = (key: string) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return this.has(fullKey, validLocale);
    };

    return translator;
  }
}

export const defaultI18nEngine = new JsonDictionaryI18nEngine();
