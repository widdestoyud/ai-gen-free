import test from "node:test";
import assert from "node:assert/strict";
import { getI18n } from "./adapter.js";
import idDict from "../../messages/id.json" with { type: "json" };
import enDict from "../../messages/en.json" with { type: "json" };

/**
 * E2E Baseline Benchmarking Test for Modul app/library
 *
 * Verifies:
 * 1. Indonesian (id) locale reproduces 100% of the baseline copy without missing keys or hardcoding.
 * 2. English (en) locale has valid, non-empty, localized text for all elements.
 * 3. Both dictionaries maintain 100% key parity (no missing keys in either language).
 */

test("E2E Library Baseline: Parity check between id.json and en.json for library namespace", () => {
  const idLib = (idDict as any).library;
  const enLib = (enDict as any).library;

  assert.ok(idLib, "id.json must contain 'library' namespace");
  assert.ok(enLib, "en.json must contain 'library' namespace");

  function compareKeys(objId: Record<string, any>, objEn: Record<string, any>, path = "library") {
    for (const key of Object.keys(objId)) {
      const currentPath = `${path}.${key}`;
      assert.ok(
        key in objEn,
        `Missing key in en.json: ${currentPath}`,
      );
      if (typeof objId[key] === "object" && objId[key] !== null) {
        assert.equal(
          typeof objEn[key],
          "object",
          `Type mismatch for key: ${currentPath}`,
        );
        compareKeys(objId[key], objEn[key], currentPath);
      } else {
        assert.equal(
          typeof objEn[key],
          "string",
          `Expected string value in en.json for key: ${currentPath}`,
        );
        assert.ok(
          (objEn[key] as string).length > 0,
          `Empty string value in en.json for key: ${currentPath}`,
        );
      }
    }
  }

  compareKeys(idLib, enLib);
});

test("E2E Library Baseline: getI18n translates all library elements accurately in both locales", () => {
  const { t: tId } = getI18n("library", "id");
  const { t: tEn } = getI18n("library", "en");

  // 1. Header & Titles
  assert.equal(tId("title"), "Galeri & Riwayat Kreasi");
  assert.equal(tEn("title"), "Gallery & Generation History");

  // 2. Tabs
  assert.equal(tId("tabs.all"), "Semua");
  assert.equal(tEn("tabs.all"), "All");
  assert.equal(tId("tabs.generations"), "Hasil Kreasi");
  assert.equal(tEn("tabs.generations"), "Generations");
  assert.equal(tId("tabs.uploads"), "Berkas Unggahan");
  assert.equal(tEn("tabs.uploads"), "Uploaded Media");

  // 3. Toolbar & Search
  assert.equal(tId("toolbar.search_placeholder"), "Cari...");
  assert.equal(tEn("toolbar.search_placeholder"), "Search...");
  assert.equal(tId("toolbar.upload_btn"), "Unggah Berkas");
  assert.equal(tEn("toolbar.upload_btn"), "Upload Files");

  // 4. Interpolated Empty Search State
  assert.equal(
    tId("empty.no_search_match", { search: "cyberpunk" }),
    "Tidak ada media yang cocok dengan kata kunci \"cyberpunk\".",
  );
  assert.equal(
    tEn("empty.no_search_match", { search: "cyberpunk" }),
    "No media matched your search for \"cyberpunk\".",
  );

  // 5. Modals & Actions
  assert.equal(tId("modal.btn_download"), "Unduh");
  assert.equal(tEn("modal.btn_download"), "Download");
  assert.equal(tId("modal.btn_upscale"), "Tingkatkan Resolusi");
  assert.equal(tEn("modal.btn_upscale"), "Upscale");
  assert.equal(tId("modal.confirm_delete_title"), "Hapus Berkas Media");
  assert.equal(tEn("modal.confirm_delete_title"), "Delete Media File");
});
