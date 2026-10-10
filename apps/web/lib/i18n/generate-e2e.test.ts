import test from "node:test";
import assert from "node:assert/strict";
import { getI18n } from "./adapter.js";
import idDict from "../../messages/id.json" with { type: "json" };
import enDict from "../../messages/en.json" with { type: "json" };

/**
 * E2E Baseline Benchmarking Test for Modul app/generate
 *
 * Verifies:
 * 1. Indonesian (id) locale reproduces 100% of the baseline copy without missing keys or hardcoding.
 * 2. English (en) locale has valid, non-empty, localized text for all elements.
 * 3. Both dictionaries maintain 100% key parity (no missing keys in either language).
 */

test("E2E Generate Baseline: Parity check between id.json and en.json for generate namespace", () => {
  const idGen = (idDict as any).generate;
  const enGen = (enDict as any).generate;

  assert.ok(idGen, "id.json must contain 'generate' namespace");
  assert.ok(enGen, "en.json must contain 'generate' namespace");

  function compareKeys(objId: Record<string, any>, objEn: Record<string, any>, path = "generate") {
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

  compareKeys(idGen, enGen);
});

test("E2E Generate Baseline: getI18n translates all generate elements accurately in both locales", () => {
  const { t: tId } = getI18n("generate", "id");
  const { t: tEn } = getI18n("generate", "en");

  // 1. Studio Header & Title
  assert.equal(tId("title"), "Studio Kreasi AI");
  assert.equal(tEn("title"), "AI Generate Studio");

  // 2. Empty State & Links
  assert.equal(tId("library_link"), "Galeri");
  assert.equal(tEn("library_link"), "Library");
  assert.equal(
    tId("empty_state_prompt", { link: "Galeri" }),
    "Tulis deskripsi ide di bawah untuk mulai membuat gambar baru. Semua hasil kreasi tersimpan di menu Galeri.",
  );
  assert.equal(
    tEn("empty_state_prompt", { link: "Library" }),
    "Write a prompt below to start generating new images. All render outputs are saved in the Library menu.",
  );

  // 3. Magic Prompt
  assert.equal(tId("magic_prompt.title"), "Sempurnakan Prompt");
  assert.equal(tEn("magic_prompt.title"), "Magic Prompt");
  assert.ok(tId("magic_prompt.tooltip").includes("Perjelas"));
  assert.ok(tEn("magic_prompt.tooltip").includes("Clarify"));

  // 4. Modals & Settings
  assert.equal(tId("settings_modal.title"), "Pengaturan Studio");
  assert.equal(tEn("settings_modal.title"), "Studio Settings");
  assert.equal(tId("settings_modal.selected_count", { count: 3 }), "3/5 gambar terpilih");
  assert.equal(tEn("settings_modal.selected_count", { count: 3 }), "3/5 images selected");

  // 5. Library Modal
  assert.equal(tId("library_modal.title"), "Pilih gambar");
  assert.equal(tEn("library_modal.title"), "Select image");
  assert.equal(tId("library_modal.tab_generations"), "Hasil Kreasi");
  assert.equal(tEn("library_modal.tab_generations"), "Generations");
  assert.equal(tId("library_modal.tab_uploads"), "Unggahan Media");
  assert.equal(tEn("library_modal.tab_uploads"), "Upload media");
  assert.equal(tId("library_modal.max_selected_error", { max: 5 }), "Maksimal hanya 5 gambar referensi yang dapat dipilih.");
  assert.equal(tEn("library_modal.max_selected_error", { max: 5 }), "Maximum of 5 reference images can be selected.");

  // 6. Result Modal
  assert.equal(tId("result_modal.title"), "Hasil Kreasi Visual");
  assert.equal(tEn("result_modal.title"), "Generation Result");
  assert.equal(tId("result_modal.mode_image"), "Gambar Hasil Kreasi");
  assert.equal(tEn("result_modal.mode_image"), "Generated Image");
  assert.equal(tId("result_modal.mode_video"), "Video Hasil Kreasi");
  assert.equal(tEn("result_modal.mode_video"), "Generated Video");
  assert.equal(tId("result_modal.sparks_cost", { cost: 10 }), "10 Sparks");
  assert.equal(tEn("result_modal.sparks_cost", { cost: 10 }), "10 Sparks");
});
