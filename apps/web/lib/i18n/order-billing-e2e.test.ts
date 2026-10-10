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

test("Phase 4: Order, Billing, Checkout & Packages dictionary parity and completeness", async (t) => {
  await t.test("Packages namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.packages).sort();
    const enKeys = getDeepKeys(enJson.packages).sort();
    assert.deepEqual(idKeys, enKeys, "Packages keys mismatch between ID and EN");
    assert.ok(idKeys.length >= 10, "Packages dictionary must contain all package keys");
  });

  await t.test("Order namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.order).sort();
    const enKeys = getDeepKeys(enJson.order).sort();
    assert.deepEqual(idKeys, enKeys, "Order keys mismatch between ID and EN");
    assert.ok(idKeys.includes("wallet_balance_title"));
    assert.ok(idKeys.includes("select_package_title"));
    assert.ok(idKeys.includes("upload_modal.title"));
    assert.ok(idKeys.includes("cancel_modal.title"));
    assert.ok(idKeys.includes("choice_modal.title"));
  });

  await t.test("Billing namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.billing).sort();
    const enKeys = getDeepKeys(enJson.billing).sort();
    assert.deepEqual(idKeys, enKeys, "Billing keys mismatch between ID and EN");
    assert.ok(idKeys.includes("balance_title"));
    assert.ok(idKeys.includes("credit_history_title"));
    assert.ok(idKeys.includes("th_date"));
    assert.ok(idKeys.includes("source_task_creation"));
  });

  await t.test("Checkout namespace has 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.checkout).sort();
    const enKeys = getDeepKeys(enJson.checkout).sort();
    assert.deepEqual(idKeys, enKeys, "Checkout keys mismatch between ID and EN");
    assert.ok(idKeys.includes("back_to_order"));
    assert.ok(idKeys.includes("payment_method_panel"));
    assert.ok(idKeys.includes("order_details_panel"));
    assert.ok(idKeys.includes("manual_qris_title"));
  });

  await t.test("Payment namespaces have 100% key parity between ID and EN", () => {
    const idKeys = getDeepKeys(idJson.payment).sort();
    const enKeys = getDeepKeys(enJson.payment).sort();
    assert.deepEqual(idKeys, enKeys, "Payment keys mismatch between ID and EN");
    assert.ok(idKeys.includes("success.title"));
    assert.ok(idKeys.includes("failed.title"));
    assert.ok(idKeys.includes("expired.title"));
  });
});
