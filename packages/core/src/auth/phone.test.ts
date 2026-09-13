import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateIndonesianPhoneNumber,
  normalizeIndonesianPhoneNumber,
  getIndonesianPhoneOperator,
  INDONESIAN_OPERATOR_PREFIXES,
} from "./phone.js";

test("INDONESIAN_OPERATOR_PREFIXES contains all required prefixes", () => {
  const prefixes = INDONESIAN_OPERATOR_PREFIXES.map((p) => p.prefix);
  
  // Telkomsel
  for (const p of ["0811", "0812", "0813", "0821", "0822", "0823", "0851", "0852", "0853"]) {
    assert.ok(prefixes.includes(p), `Missing Telkomsel prefix ${p}`);
  }

  // Indosat / Tri
  for (const p of ["0814", "0815", "0816", "0855", "0856", "0857", "0858", "0895", "0896", "0897", "0898", "0899"]) {
    assert.ok(prefixes.includes(p), `Missing Indosat prefix ${p}`);
  }

  // XL / Axis
  for (const p of ["0817", "0818", "0819", "0859", "0877", "0878", "0831", "0832", "0833", "0838"]) {
    assert.ok(prefixes.includes(p), `Missing XL/Axis prefix ${p}`);
  }

  // Smartfren
  for (const p of ["0881", "0882", "0883", "0884", "0885", "0886", "0887", "0888", "0889"]) {
    assert.ok(prefixes.includes(p), `Missing Smartfren prefix ${p}`);
  }
});

test("normalizeIndonesianPhoneNumber handles spaces, dashes, +62 and 62", () => {
  assert.equal(normalizeIndonesianPhoneNumber("+62 812-3456-7890"), "081234567890");
  assert.equal(normalizeIndonesianPhoneNumber("6281234567890"), "081234567890");
  assert.equal(normalizeIndonesianPhoneNumber("0812 3456 7890"), "081234567890");
});

test("validateIndonesianPhoneNumber accepts valid numbers from all 4 providers", () => {
  // Telkomsel
  const tsel = validateIndonesianPhoneNumber("081212345678");
  assert.equal(tsel.valid, true);
  assert.equal(tsel.operator, "Telkomsel");
  assert.equal(tsel.brand, "Kartu Halo / simPATI");

  // Indosat (IM3)
  const isat = validateIndonesianPhoneNumber("+6285612345678");
  assert.equal(isat.valid, true);
  assert.equal(isat.operator, "Indosat Ooredoo Hutchison");
  assert.equal(isat.brand, "IM3");

  // Tri
  const tri = validateIndonesianPhoneNumber("089612345678");
  assert.equal(tri.valid, true);
  assert.equal(tri.operator, "Indosat Ooredoo Hutchison");
  assert.equal(tri.brand, "Tri (3)");

  // XL
  const xl = validateIndonesianPhoneNumber("081812345678");
  assert.equal(xl.valid, true);
  assert.equal(xl.operator, "XL Axiata");

  // Axis
  const axis = validateIndonesianPhoneNumber("083812345678");
  assert.equal(axis.valid, true);
  assert.equal(axis.operator, "XL Axiata");
  assert.equal(axis.brand, "Axis");

  // Smartfren
  const sf = validateIndonesianPhoneNumber("088812345678");
  assert.equal(sf.valid, true);
  assert.equal(sf.operator, "Smartfren");
});

test("validateIndonesianPhoneNumber rejects invalid prefixes, invalid lengths, and non-numeric", () => {
  // Invalid prefix (e.g. 0809, 0844, 0866)
  const inv1 = validateIndonesianPhoneNumber("080912345678");
  assert.equal(inv1.valid, false);
  assert.ok(inv1.error?.includes("bukan prefix operator seluler Indonesia yang valid"));

  const inv2 = validateIndonesianPhoneNumber("084412345678");
  assert.equal(inv2.valid, false);

  // Too short
  const short = validateIndonesianPhoneNumber("0812345");
  assert.equal(short.valid, false);
  assert.ok(short.error?.includes("terlalu pendek"));

  // Too long
  const long = validateIndonesianPhoneNumber("08123456789012345");
  assert.equal(long.valid, false);
  assert.ok(long.error?.includes("terlalu panjang"));

  // Not starting with 08
  const no08 = validateIndonesianPhoneNumber("0215551234");
  assert.equal(no08.valid, false);
});

test("getIndonesianPhoneOperator detects operator from prefix", () => {
  assert.equal(getIndonesianPhoneOperator("08123456789")?.operator, "Telkomsel");
  assert.equal(getIndonesianPhoneOperator("+628563456789")?.operator, "Indosat Ooredoo Hutchison");
  assert.equal(getIndonesianPhoneOperator("08773456789")?.operator, "XL Axiata");
  assert.equal(getIndonesianPhoneOperator("08823456789")?.operator, "Smartfren");
  assert.equal(getIndonesianPhoneOperator("08093456789"), null);
});
