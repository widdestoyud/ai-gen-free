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

function resolveTranslation(
  locale: Locale,
  key: string,
  namespace?: string,
): string | undefined {
  const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
  const fallbackDict = DICTIONARIES[DEFAULT_LOCALE];

  // 1. Try namespace.key if namespace provided
  if (namespace) {
    const scopedKey = `${namespace}.${key}`;
    const scopedVal = getNestedValue(dict, scopedKey) ?? (locale !== DEFAULT_LOCALE ? getNestedValue(fallbackDict, scopedKey) : undefined);
    if (scopedVal !== undefined) return scopedVal;
  }

  // 2. Fallback to direct key at root
  const directVal = getNestedValue(dict, key) ?? (locale !== DEFAULT_LOCALE ? getNestedValue(fallbackDict, key) : undefined);
  if (directVal !== undefined) return directVal;

  return undefined;
}

function hasTranslation(
  locale: Locale,
  key: string,
  namespace?: string,
): boolean {
  const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
  const fallbackDict = DICTIONARIES[DEFAULT_LOCALE];

  if (namespace) {
    const scopedKey = `${namespace}.${key}`;
    if (getNestedValue(dict, scopedKey) !== undefined || getNestedValue(fallbackDict, scopedKey) !== undefined) {
      return true;
    }
  }

  return getNestedValue(dict, key) !== undefined || getNestedValue(fallbackDict, key) !== undefined;
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
        const text = resolveTranslation(locale, key, namespace);
        if (!text) {
          return namespace ? `${namespace}.${key}` : key;
        }
        return interpolate(text, params);
      };

      translator.has = (key: string) => hasTranslation(locale, key, namespace);

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
      const text = resolveTranslation(activeLocale, key, namespace);
      if (!text) {
        return namespace ? `${namespace}.${key}` : key;
      }
      return interpolate(text, params);
    };

    translator.has = (key: string) => hasTranslation(activeLocale, key, namespace);

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
  const t: I18nTranslator = (key: string, params?: TranslationParams) => {
    const text = resolveTranslation(locale, key, namespace);
    if (!text) {
      return namespace ? `${namespace}.${key}` : key;
    }
    return interpolate(text, params);
  };

  t.has = (key: string) => hasTranslation(locale, key, namespace);

  return { t, locale };
}
