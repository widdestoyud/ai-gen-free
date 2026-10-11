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

test("Phase 5: Auth, Landing, Modals dictionary parity and completeness", async (t) => {
  await t.test("Auth namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.auth).sort();
    const enKeys = getDeepKeys(enJson.auth).sort();
    assert.deepEqual(idKeys, enKeys, "Auth keys mismatch between ID and EN");
    assert.ok(idKeys.includes("login.title"));
    assert.ok(idKeys.includes("register.title"));
    assert.ok(idKeys.includes("forgot_password.modal_title"));
    assert.ok(idKeys.includes("otp.modal_title"));
    assert.ok(idKeys.includes("google_button.label"));
  });

  await t.test("Landing namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.landing).sort();
    const enKeys = getDeepKeys(enJson.landing).sort();
    assert.deepEqual(idKeys, enKeys, "Landing keys mismatch between ID and EN");
    assert.ok(idKeys.includes("hero.giant_title_1"));
    assert.ok(idKeys.includes("features.tag"));
    assert.ok(idKeys.includes("pricing.tag"));
    assert.ok(idKeys.includes("faq.tag"));
    assert.ok(idKeys.includes("steps.tag"));
    assert.ok(idKeys.includes("models.title"));
    assert.ok(idKeys.includes("privacy.tag"));
    assert.ok(idKeys.includes("footer.terms"));
  });

  await t.test("Modals namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.modals).sort();
    const enKeys = getDeepKeys(enJson.modals).sort();
    assert.deepEqual(idKeys, enKeys, "Modals keys mismatch between ID and EN");
    assert.ok(idKeys.includes("logout.title"));
    assert.ok(idKeys.includes("spicy.title_active"));
    assert.ok(idKeys.includes("terms.title"));
    assert.ok(idKeys.includes("upload_policy.title"));
  });

  await t.test("Nav namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.nav).sort();
    const enKeys = getDeepKeys(enJson.nav).sort();
    assert.deepEqual(idKeys, enKeys, "Nav keys mismatch between ID and EN");
    assert.ok(idKeys.includes("generate"));
    assert.ok(idKeys.includes("billing"));
    assert.ok(idKeys.includes("library"));
    assert.ok(idKeys.includes("profile"));
    assert.ok(idKeys.includes("order"));
    assert.ok(idKeys.includes("logout"));
  });
});
