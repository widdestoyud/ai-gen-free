import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from "./port";
import Negotiator from "negotiator";

export interface HeaderSource {
  get(name: string): string | null | undefined;
}

export interface CookieSource {
  get(name: string): { value?: string } | string | undefined;
}

/**
 * Cleanly resolves user locale from Cookie, Device Settings (Accept-Language), or GeoIP.
 *
 * Precedence:
 * 1. User Explicit Cookie (NEXT_LOCALE)
 * 2. Device OS Language (Accept-Language header)
 * 3. Server GeoIP Country (cf-ipcountry header)
 * 4. Default Fallback ('id')
 */
export function detectLocale(
  cookies?: CookieSource | null,
  headers?: HeaderSource | null,
): Locale {
  // 1. User Explicit Cookie (NEXT_LOCALE)
  if (cookies) {
    const rawCookie = cookies.get("NEXT_LOCALE");
    const cookieVal = typeof rawCookie === "object" ? rawCookie?.value : rawCookie;
    if (cookieVal && typeof cookieVal === "string") {
      const clean = cookieVal.trim().toLowerCase();
      if (SUPPORTED_LOCALES.includes(clean as Locale)) {
        return clean as Locale;
      }
    }
  }

  // 2. Server GeoIP Country (Cloudflare cf-ipcountry)
  if (headers) {
    const country = headers.get("cf-ipcountry");
    if (country && typeof country === "string") {
      const upper = country.trim().toUpperCase();
      if (upper === "ID") {
        return "id";
      }
      return "en";
    }

    // 3. Device OS Language (Accept-Language)
    const acceptLang = headers.get("accept-language");
    if (acceptLang) {
      try {
        const languages = new Negotiator({
          headers: { "accept-language": acceptLang },
        }).languages();

        const primary = languages[0]?.toLowerCase() || "";
        if (primary.startsWith("id") || primary.includes("id-id") || primary.includes("in-id")) {
          return "id";
        }
      } catch {
        // Ignore parsing errors and fallback
      }
    }
  }

  return DEFAULT_LOCALE;
}
