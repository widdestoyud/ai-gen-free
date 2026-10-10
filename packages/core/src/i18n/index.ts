export * from "./port.js";
export * from "./engine.js";

import { defaultI18nEngine } from "./engine.js";
import type { TranslationParams } from "./port.js";

/**
 * Universal backend translation helper.
 *
 * Example:
 * const message = t("errors.A018", "en");
 */
export function t(key: string, locale?: string | null, params?: TranslationParams): string {
  return defaultI18nEngine.translate(key, locale, params);
}
