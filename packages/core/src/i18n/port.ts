/**
 * Backend I18n Port Contract - Liskov Substitution Principle (LSP)
 *
 * Defines the contract for backend translation and locale resolution.
 * Any i18n implementation (JSON dictionary, ICU messageformat, external service)
 * must conform to this port without breaking consumers.
 */

export type Locale = "id" | "en";
export const SUPPORTED_LOCALES: readonly Locale[] = ["id", "en"] as const;
export const DEFAULT_LOCALE: Locale = "id";

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

export interface I18nTranslator {
  (key: string, params?: TranslationParams): string;
  has(key: string): boolean;
}

export interface I18nBackendPort {
  /**
   * Translate a message key for a given locale with optional interpolation parameters.
   */
  translate(key: string, locale?: string | null, params?: TranslationParams): string;

  /**
   * Check if a translation key exists.
   */
  has(key: string, locale?: string | null): boolean;

  /**
   * Resolve target locale from request headers (x-locale, accept-language, cf-ipcountry).
   */
  resolveLocale(headers?: Record<string, string | string[] | undefined | null>): Locale;

  /**
   * Get a scoped translator function bound to a specific locale and optional namespace.
   */
  getTranslator(locale?: string | null, namespace?: string): I18nTranslator;
}
