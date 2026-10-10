import { test } from "node:test";
import assert from "node:assert/strict";
import idJson from "../../messages/id.json";
import enJson from "../../messages/en.json";

function getDeepKeys(obj: Record<string, any>, prefix = ""): string[] {
  return Object.keys(obj).reduce((res: string[], el) => {
    const name = prefix ? `${prefix}.${el}` : el;
    if (typeof obj[el] === "object" && obj[el] !== null && !Array.isArray(obj[el])) {
      res.push(...getDeepKeys(obj[el], name));
    } else {
      res.push(name);
    }
    return res;
  }, []);
}

test("Phase 6: Profile & Admin dictionary parity and completeness", async (t) => {
  await t.test("Profile namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.profile).sort();
    const enKeys = getDeepKeys(enJson.profile).sort();
    assert.deepEqual(idKeys, enKeys, "Profile keys mismatch between ID and EN");
    assert.ok(idKeys.includes("title"));
    assert.ok(idKeys.includes("label_username"));
    assert.ok(idKeys.includes("label_gender"));
    assert.ok(idKeys.includes("label_dob"));
    assert.ok(idKeys.includes("label_phone"));
    assert.ok(idKeys.includes("label_address"));
    assert.ok(idKeys.includes("label_password"));
    assert.ok(idKeys.includes("label_spicy_mode"));
  });

  await t.test("Admin namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.admin).sort();
    const enKeys = getDeepKeys(enJson.admin).sort();
    assert.deepEqual(idKeys, enKeys, "Admin keys mismatch between ID and EN");
    assert.ok(idKeys.includes("badge"));
    assert.ok(idKeys.includes("nav.curation"));
    assert.ok(idKeys.includes("nav.models"));
    assert.ok(idKeys.includes("nav.packages"));
    assert.ok(idKeys.includes("nav.settings"));
    assert.ok(idKeys.includes("nav.users"));
    assert.ok(idKeys.includes("nav.jobs"));
    assert.ok(idKeys.includes("nav.telemetry"));
    assert.ok(idKeys.includes("nav.audit"));
    assert.ok(idKeys.includes("nav.logout"));
    assert.ok(idKeys.includes("home.title"));
    assert.ok(idKeys.includes("login.page_title"));
  });
});
