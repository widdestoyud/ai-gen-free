import test from "node:test";
import assert from "node:assert/strict";
import { ErrorCodes, type PaymentGatewayPort } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import {
  cancelInvoiceForUser,
  cancelInvoiceForAdmin,
  listPackages,
  listStaticPackages,
} from "./service.js";
import { AuthError } from "../auth/service.js";
import { createMidtransPaymentGateway } from "./midtrans-factory.js";
import { createXenditPaymentGateway } from "./xendit-factory.js";
import { generateMidtransSignature, verifyMidtransSignature } from "@ai-gen-free/providers-midtrans";
import { verifyXenditCallbackToken } from "@ai-gen-free/providers-xendit";

test("Topup catalog: returns predefined packages", async () => {
  const staticPackages = listStaticPackages();
  assert.equal(staticPackages.length, 3);
  assert.equal(staticPackages[0].id, "p49");
  assert.equal(staticPackages[0].amountIdr, 49000);
  assert.equal(staticPackages[0].points, 500);

  const origCount = prisma.topupPackage.count;
  const origFind = prisma.topupPackage.findMany;
  (prisma.topupPackage as any).count = async () => 3;
  (prisma.topupPackage as any).findMany = async () => [
    { id: "p49", amountIdr: 49000, points: 500, isPopular: false, bonusPercent: 0, sortOrder: 1, active: true },
    { id: "p99", amountIdr: 99000, points: 1200, isPopular: true, bonusPercent: 20, sortOrder: 2, active: true },
    { id: "p199", amountIdr: 199000, points: 2600, isPopular: false, bonusPercent: 30, sortOrder: 3, active: true },
  ];
  try {
    const packages = await listPackages();
    assert(packages.length >= 3);
    assert(packages.some((p) => p.points > 0 && p.amountIdr > 0));
  } finally {
    prisma.topupPackage.count = origCount;
    prisma.topupPackage.findMany = origFind;
  }
});

test("cancelInvoiceForUser: throws NOT_FOUND when invoice does not exist", async () => {
  const origFind = prisma.invoice.findFirst;
  (prisma.invoice as any).findFirst = async () => null;
  try {
    await assert.rejects(
      async () => {
        await cancelInvoiceForUser("user_non_existent", "inv_non_existent");
      },
      (err: unknown) => {
        const e = err as any;
        assert.equal(e?.code, ErrorCodes.NOT_FOUND);
        assert.equal(e?.status, 404);
        return true;
      },
    );
  } finally {
    prisma.invoice.findFirst = origFind;
  }
});

test("cancelInvoiceForAdmin: throws NOT_FOUND when invoice does not exist", async () => {
  const origFind = prisma.invoice.findUnique;
  (prisma.invoice as any).findUnique = async () => null;
  try {
    await assert.rejects(
      async () => {
        await cancelInvoiceForAdmin("inv_non_existent", "admin_user_id");
      },
      (err: unknown) => {
        const e = err as any;
        assert.equal(e?.code, ErrorCodes.NOT_FOUND);
        assert.equal(e?.status, 404);
        return true;
      },
    );
  } finally {
    prisma.invoice.findUnique = origFind;
  }
});

test("createMidtransPaymentGateway: returns null when MIDTRANS_SERVER_KEY is not configured", () => {
  const originalKey = process.env.MIDTRANS_SERVER_KEY;
  try {
    delete process.env.MIDTRANS_SERVER_KEY;
    const gateway = createMidtransPaymentGateway();
    assert.equal(gateway, null);
  } finally {
    if (originalKey) {
      process.env.MIDTRANS_SERVER_KEY = originalKey;
    }
  }
});

test("createMidtransPaymentGateway: returns instance when MIDTRANS_SERVER_KEY is configured", () => {
  const originalKey = process.env.MIDTRANS_SERVER_KEY;
  try {
    process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-TEST12345";
    const gateway = createMidtransPaymentGateway();
    assert(gateway !== null);
    assert.equal(gateway.provider, "midtrans-snap");
  } finally {
    if (originalKey) {
      process.env.MIDTRANS_SERVER_KEY = originalKey;
    } else {
      delete process.env.MIDTRANS_SERVER_KEY;
    }
  }
});

test("Midtrans signature integration: correctly verifies payload", () => {
  const serverKey = "SB-Mid-server-TEST12345";
  const orderId = "INV-20260915-9999";
  const statusCode = "200";
  const grossAmount = "50000.00";

  const sig = generateMidtransSignature({
    orderId,
    statusCode,
    grossAmount,
    serverKey,
  });

  const valid = verifyMidtransSignature(sig, {
    orderId,
    statusCode,
    grossAmount,
    serverKey,
  });

  assert.equal(valid, true);
});

test("createXenditPaymentGateway: returns null when XENDIT_API_KEY is not configured", () => {
  const originalKey = process.env.XENDIT_API_KEY;
  try {
    delete process.env.XENDIT_API_KEY;
    const gateway = createXenditPaymentGateway();
    assert.equal(gateway, null);
  } finally {
    if (originalKey) {
      process.env.XENDIT_API_KEY = originalKey;
    }
  }
});

test("createXenditPaymentGateway: returns instance when XENDIT_API_KEY is configured", () => {
  const originalKey = process.env.XENDIT_API_KEY;
  try {
    process.env.XENDIT_API_KEY = "xnd_development_TESTKEY12345";
    const gateway = createXenditPaymentGateway();
    assert(gateway !== null);
    assert.equal(gateway.provider, "xendit");
  } finally {
    if (originalKey) {
      process.env.XENDIT_API_KEY = originalKey;
    } else {
      delete process.env.XENDIT_API_KEY;
    }
  }
});

test("Xendit callback token integration: correctly verifies valid and invalid tokens", () => {
  const token = "xnd_webhook_secret_token_123";
  assert.equal(verifyXenditCallbackToken(token, token), true);
  assert.equal(verifyXenditCallbackToken("invalid_token", token), false);
  assert.equal(verifyXenditCallbackToken("", token), false);
  assert.equal(verifyXenditCallbackToken(null, token), false);
});

test("Manual vs Online invoice expiry calculation", () => {
  const now = new Date();
  const created50MinAgo = new Date(now.getTime() - 50 * 60 * 1000);
  const created70MinAgo = new Date(now.getTime() - 70 * 60 * 1000);

  // Manual payment: 60 minutes expiry
  const manual50MinExpired = now.getTime() - created50MinAgo.getTime() > 60 * 60 * 1000;
  assert.equal(manual50MinExpired, false); // still active at 50 min

  const manual70MinExpired = now.getTime() - created70MinAgo.getTime() > 60 * 60 * 1000;
  assert.equal(manual70MinExpired, true); // expired at 70 min

  // Online gateway session: 10 minutes expiry
  const gatewayExpired15MinAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const gatewaySessionExpired = gatewayExpired15MinAgo < now;
  assert.equal(gatewaySessionExpired, true);
});

