/**
 * Web I18n Port Contract - Liskov Substitution Principle (LSP)
 *
 * All UI views, components, and hooks must ONLY depend on this contract.
 * Never import vendor-specific i18n libraries directly into view components.
 */

export type Locale = "id" | "en";
export const SUPPORTED_LOCALES: readonly Locale[] = ["id", "en"] as const;
export const DEFAULT_LOCALE: Locale = "id";

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

export interface I18nTranslator {
  (key: string, params?: TranslationParams): string;
  has(key: string): boolean;
}

export interface I18nContextValue {
  t: I18nTranslator;
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  availableLocales: readonly Locale[];
}

export interface I18nHookResult extends I18nTranslator {
  t: I18nTranslator;
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  availableLocales: readonly Locale[];
}

