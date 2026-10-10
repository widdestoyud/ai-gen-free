"use client";

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from "react";
import {
  DEFAULT_LOCALE,
  type I18nContextValue,
  type I18nHookResult,
  type I18nTranslator,
  type Locale,
  SUPPORTED_LOCALES,
  type TranslationParams,
} from "./port";
import idDict from "../../messages/id.json";
import enDict from "../../messages/en.json";

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

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  initialLocale?: Locale;
  children: React.ReactNode;
}

export function I18nProvider({ initialLocale = DEFAULT_LOCALE, children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Sync with cookie if present on mount
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
    if (match && match[1]) {
      const cookieLocale = decodeURIComponent(match[1]).toLowerCase();
      if (SUPPORTED_LOCALES.includes(cookieLocale as Locale) && cookieLocale !== locale) {
        setLocaleState(cookieLocale as Locale);
      }
    }
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) return;
    setLocaleState(nextLocale);
    // Write cookie for 1 year
    document.cookie = `NEXT_LOCALE=${encodeURIComponent(nextLocale)};path=/;max-age=31536000;SameSite=Lax`;
  }, []);

  const createTranslator = useCallback(
    (namespace?: string): I18nTranslator => {
      const translator: I18nTranslator = (key: string, params?: TranslationParams) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
        let text = getNestedValue(dict, fullKey);

        if (!text && locale !== DEFAULT_LOCALE) {
          text = getNestedValue(DICTIONARIES[DEFAULT_LOCALE], fullKey);
        }

        if (!text) {
          return fullKey;
        }

        return interpolate(text, params);
      };

      translator.has = (key: string) => {
        const fullKey = namespace ? `${namespace}.${key}` : key;
        const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
        return getNestedValue(dict, fullKey) !== undefined;
      };

      return translator;
    },
    [locale],
  );

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      t: createTranslator(),
      locale,
      setLocale,
      availableLocales: SUPPORTED_LOCALES,
    }),
    [createTranslator, locale, setLocale],
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

/**
 * Universal useI18n hook implementing LSP.
 * Views only ever import and call this hook.
 */
export function useI18n(namespace?: string): I18nHookResult {
  const ctx = useContext(I18nContext);
  const activeLocale = ctx?.locale || DEFAULT_LOCALE;

  const scopedT = useMemo<I18nTranslator>(() => {
    const translator: I18nTranslator = (key: string, params?: TranslationParams) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const dict = DICTIONARIES[activeLocale] || DICTIONARIES[DEFAULT_LOCALE];
      let text = getNestedValue(dict, fullKey);

      if (!text && activeLocale !== DEFAULT_LOCALE) {
        text = getNestedValue(DICTIONARIES[DEFAULT_LOCALE], fullKey);
      }

      if (!text) {
        return fullKey;
      }

      return interpolate(text, params);
    };

    translator.has = (key: string) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const dict = DICTIONARIES[activeLocale] || DICTIONARIES[DEFAULT_LOCALE];
      return getNestedValue(dict, fullKey) !== undefined;
    };

    return translator;
  }, [activeLocale, namespace]);

  return useMemo(() => {
    const hookResult = ((key: string, params?: TranslationParams) => scopedT(key, params)) as I18nHookResult;
    hookResult.has = (key: string) => scopedT.has(key);
    hookResult.t = scopedT;
    hookResult.locale = activeLocale;
    hookResult.setLocale = ctx?.setLocale || (() => {});
    hookResult.availableLocales = SUPPORTED_LOCALES;
    return hookResult;
  }, [scopedT, activeLocale, ctx?.setLocale]);
}

/**
 * Server Component i18n translation resolver
 */
export function getI18n(namespace?: string, locale: Locale = DEFAULT_LOCALE): { t: I18nTranslator; locale: Locale } {
  const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];

  const t: I18nTranslator = (key: string, params?: TranslationParams) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    let text = getNestedValue(dict, fullKey);
    if (!text && locale !== DEFAULT_LOCALE) {
      text = getNestedValue(DICTIONARIES[DEFAULT_LOCALE], fullKey);
    }
    if (!text) return fullKey;
    return interpolate(text, params);
  };

  t.has = (key: string) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return getNestedValue(dict, fullKey) !== undefined;
  };

  return { t, locale };
}
