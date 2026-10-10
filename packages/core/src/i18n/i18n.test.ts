import test from "node:test";
import assert from "node:assert/strict";
import { defaultI18nEngine, JsonDictionaryI18nEngine, t } from "./index.js";

test("Backend I18n: translates keys in Indonesian (default) and English", () => {
  assert.equal(t("errors.A018", "id"), "Kode OTP tidak valid atau telah kedaluwarsa.");
  assert.equal(t("errors.A018", "en"), "Invalid or expired OTP code.");
});

test("Backend I18n: handles interpolation parameters properly", () => {
  assert.equal(
    defaultI18nEngine.translate("messages.INVOICE_CANCELED", "id", { code: "INV-12345" }),
    "Pesanan #INV-12345 berhasil dibatalkan.",
  );
  assert.equal(
    defaultI18nEngine.translate("messages.INVOICE_CANCELED", "en", { code: "INV-12345" }),
    "Order #INV-12345 has been successfully canceled.",
  );
});

test("Backend I18n: resolveLocale correctly parses x-locale, Accept-Language, and GeoIP headers", () => {
  // 1. Explicit x-locale
  assert.equal(defaultI18nEngine.resolveLocale({ "x-locale": "en" }), "en");
  assert.equal(defaultI18nEngine.resolveLocale({ "x-locale": "id" }), "id");

  // 2. Accept-Language
  assert.equal(defaultI18nEngine.resolveLocale({ "accept-language": "id-ID,id;q=0.9" }), "id");
  assert.equal(defaultI18nEngine.resolveLocale({ "accept-language": "en-US,en;q=0.9" }), "en");
  assert.equal(defaultI18nEngine.resolveLocale({ "accept-language": "ja-JP,ja;q=0.9,en;q=0.8" }), "en");
  assert.equal(defaultI18nEngine.resolveLocale({ "accept-language": "ms-MY,ms;q=0.9,en;q=0.8" }), "en");

  // 3. GeoIP header (cf-ipcountry)
  assert.equal(defaultI18nEngine.resolveLocale({ "cf-ipcountry": "ID" }), "id");
  assert.equal(defaultI18nEngine.resolveLocale({ "cf-ipcountry": "MY" }), "en");
  assert.equal(defaultI18nEngine.resolveLocale({ "cf-ipcountry": "JP" }), "en");
  assert.equal(defaultI18nEngine.resolveLocale({ "cf-ipcountry": "US" }), "en");

  // 4. Default fallback
  assert.equal(defaultI18nEngine.resolveLocale({}), "id");
  assert.equal(defaultI18nEngine.resolveLocale(undefined), "id");
});

test("Backend I18n: LSP allows substituting custom dictionaries without breaking interface", () => {
  const customEngine = new JsonDictionaryI18nEngine({
    id: { custom: { greeting: "Halo {name}" } },
    en: { custom: { greeting: "Hello {name}" } },
  });

  assert.equal(customEngine.translate("custom.greeting", "id", { name: "Budi" }), "Halo Budi");
  assert.equal(customEngine.translate("custom.greeting", "en", { name: "John" }), "Hello John");

  const scopedT = customEngine.getTranslator("en", "custom");
  assert.equal(scopedT("greeting", { name: "Alice" }), "Hello Alice");
});
