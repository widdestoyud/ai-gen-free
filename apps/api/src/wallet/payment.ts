/**
 * Payment Service - Payment Gateway Integration (Midtrans / Generic)
 * Handles creating payments, processing webhooks, and status checks
 */

import { LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { ErrorCodes, type PaymentGatewayPort } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import { refreshWalletCache } from "@ai-gen-free/wallet";
import { AuthError } from "../auth/service.js";

function asInt(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

export interface PaymentServiceDeps {
  paymentGateway: PaymentGatewayPort;
  callbackBaseUrl: string;
  paymentDueMinutes?: number;
}

/**
 * Initiate payment untuk invoice via payment gateway (Midtrans Snap)
 * - Hanya invoice dengan status unpaid atau rejected yang bisa dibayar
 * - Return payment URL & token untuk redirect customer
 */
export async function initiatePayment(
  deps: PaymentServiceDeps,
  opts: {
    userId: string;
    invoiceId: string;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
  },
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: opts.invoiceId, userId: opts.userId },
    include: { user: { select: { email: true, displayName: true, phoneNumber: true } } },
  });

  if (!invoice) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  }

  // Cek apakah sudah dibayar
  if (invoice.status === "paid") {
    throw new AuthError(ErrorCodes.PAYMENT_ALREADY_PAID, "Invoice sudah dibayar");
  }

  // Cek apakah bisa dibayar via gateway (unpaid atau rejected)
  if (invoice.status !== "unpaid" && invoice.status !== "rejected") {
    throw new AuthError(
      ErrorCodes.INVOICE_NOT_PAYABLE,
      `Invoice dengan status ${invoice.status} tidak bisa dibayar`,
    );
  }

  // Cek jika sudah ada payment session yang belum expired
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const clientKey = process.env.MIDTRANS_CLIENT_KEY;
  const snapUrl = isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

  if (invoice.gatewayPaymentUrl && invoice.gatewayExpiredAt) {
    const now = new Date();
    if (invoice.gatewayExpiredAt > now) {
      // Masih ada session aktif, return existing URL & token
      return {
        invoiceId: invoice.id,
        paymentUrl: invoice.gatewayPaymentUrl,
        tokenId: invoice.gatewayToken,
        expiredAt: invoice.gatewayExpiredAt.toISOString(),
        clientKey: clientKey ?? undefined,
        snapUrl,
        isProduction,
        isExisting: true,
      };
    }
  }

  // Create payment session via Payment Gateway
  const callbackUrl = `${deps.callbackBaseUrl}/app/billing?invoice=${invoice.id}`;

  const result = await deps.paymentGateway.createPayment({
    invoiceNumber: invoice.uniqueCode,
    amount: asInt(invoice.amountIdr),
    customerEmail: opts.customerEmail ?? invoice.user.email,
    customerName: opts.customerName ?? invoice.user.displayName ?? undefined,
    customerPhone: opts.customerPhone ?? invoice.user.phoneNumber ?? undefined,
    callbackUrl,
    paymentDueMinutes: deps.paymentDueMinutes ?? 60,
    lineItems: [
      {
        name: `Top Up ${asInt(invoice.points)} Poin`,
        price: asInt(invoice.amountIdr),
        quantity: 1,
      },
    ],
  });

  if (!result.success || !result.paymentUrl) {
    throw new AuthError(
      ErrorCodes.PAYMENT_GATEWAY_ERROR,
      result.error ?? "Gagal membuat sesi pembayaran",
    );
  }

  // Update invoice dengan gateway session info
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paymentMethod: "midtrans",
      paymentGateway: deps.paymentGateway.provider,
      gatewayToken: result.tokenId,
      gatewaySessionId: result.sessionId,
      gatewayPaymentUrl: result.paymentUrl,
      gatewayExpiredAt: result.expiredDate,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: opts.userId,
      action: "invoice.gateway_payment_initiated",
      target: invoice.id,
      meta: {
        uniqueCode: invoice.uniqueCode,
        amountIdr: asInt(invoice.amountIdr),
        tokenId: result.tokenId,
        gateway: deps.paymentGateway.provider,
      },
    },
  });

  return {
    invoiceId: invoice.id,
    paymentUrl: result.paymentUrl,
    tokenId: result.tokenId,
    expiredAt: result.expiredDate?.toISOString(),
    clientKey: clientKey ?? undefined,
    snapUrl,
    isProduction,
    isExisting: false,
  };
}

/**
 * Process notification dari payment gateway webhook (Midtrans)
 * - Verify signature
 * - Update invoice status
 * - Credit poin jika SUCCESS
 */
export async function processPaymentNotification(
  deps: PaymentServiceDeps,
  payload: unknown,
  headers: Record<string, string>,
) {
  // Verify notification
  const verification = await deps.paymentGateway.verifyNotification(payload, headers);

  if (!verification.valid) {
    throw new AuthError(
      ErrorCodes.PAYMENT_NOTIFICATION_INVALID,
      verification.error ?? "Notifikasi pembayaran tidak valid",
    );
  }

  const { invoiceNumber, status, paymentChannel, paymentMethod, amount } = verification;

  if (!invoiceNumber) {
    throw new AuthError(ErrorCodes.PAYMENT_NOTIFICATION_INVALID, "Invoice number tidak ditemukan");
  }

  // Find invoice by uniqueCode
  const invoice = await prisma.invoice.findFirst({
    where: { uniqueCode: invoiceNumber },
  });

  if (!invoice) {
    throw new AuthError(ErrorCodes.NOT_FOUND, `Invoice ${invoiceNumber} tidak ditemukan`, 404);
  }

  // Already processed
  if (invoice.status === "paid") {
    return {
      invoiceId: invoice.id,
      status: "already_paid",
      message: "Invoice sudah dibayar sebelumnya",
    };
  }

  // Update payment channel info
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      gatewayPaymentChannel: paymentChannel,
      gatewayPaymentType: paymentMethod,
    },
  });

  if (status === "SUCCESS") {
    // Process successful payment
    return await processSuccessfulPayment(invoice.id, invoice.userId, asInt(invoice.points), {
      paymentChannel,
      paymentMethod,
      amount,
      provider: deps.paymentGateway.provider,
    });
  }

  if (status === "FAILED") {
    // Mark as rejected (bisa retry dengan payment baru)
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "rejected",
        reviewNote: `Pembayaran via ${paymentChannel ?? "Payment Gateway"} gagal/kedaluwarsa`,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "invoice.gateway_payment_failed",
        target: invoice.id,
        meta: { paymentChannel, paymentMethod, gateway: deps.paymentGateway.provider },
      },
    });

    return {
      invoiceId: invoice.id,
      status: "failed",
      message: "Pembayaran gagal",
    };
  }

  // PENDING - do nothing, wait for final status
  return {
    invoiceId: invoice.id,
    status: "pending",
    message: "Menunggu pembayaran",
  };
}

/**
 * Process successful payment - credit poin ke wallet
 */
async function processSuccessfulPayment(
  invoiceId: string,
  userId: string,
  points: number,
  meta: { paymentChannel?: string; paymentMethod?: string; amount?: number; provider?: string },
) {
  try {
    const paid = await prisma.$transaction(async (tx) => {
      // Ensure wallet exists
      await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      // Lock wallet
      await tx.$queryRaw`SELECT "userId" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

      // Check if already paid (idempotency)
      const existingEntry = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey: `midtrans:${invoiceId}` },
      });

      if (existingEntry) {
        // Already processed
        const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
        return { invoice: current, alreadyProcessed: true };
      }

      // Update invoice to paid
      const moved = await tx.invoice.updateMany({
        where: { id: invoiceId, status: { in: ["unpaid", "awaiting_review", "rejected"] } },
        data: {
          status: "paid",
          paidAt: new Date(),
          reviewNote: null,
        },
      });

      if (moved.count === 0) {
        const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
        if (current.status === "paid") {
          return { invoice: current, alreadyProcessed: true };
        }
        throw new AuthError(ErrorCodes.INVOICE_NOT_PAYABLE, "Invoice tidak dapat diproses");
      }

      // Increment wallet version
      await tx.wallet.update({
        where: { userId },
        data: { version: { increment: 1 } },
      });

      // Create ledger entry for topup
      await tx.ledgerEntry.create({
        data: {
          userId,
          invoiceId,
          type: LedgerType.topup,
          status: LedgerStatus.posted,
          amount: points,
          idempotencyKey: `midtrans:${invoiceId}`,
          reason: `Pembayaran Midtrans via ${meta.paymentChannel ?? "Midtrans"}`,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "invoice.gateway_payment_success",
          target: invoiceId,
          meta: {
            points,
            paymentChannel: meta.paymentChannel,
            paymentMethod: meta.paymentMethod,
            amountIdr: meta.amount,
            provider: meta.provider,
          },
        },
      });

      return {
        invoice: await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } }),
        alreadyProcessed: false,
      };
    });

    // Refresh wallet cache
    if (!paid.alreadyProcessed) {
      await refreshWalletCache(userId);
    }

    return {
      invoiceId,
      status: "success",
      message: paid.alreadyProcessed ? "Pembayaran sudah diproses sebelumnya" : "Pembayaran berhasil",
      points,
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;

    // Handle Prisma unique constraint error (double processing)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        invoiceId,
        status: "already_paid",
        message: "Invoice sudah diproses sebelumnya",
      };
    }

    throw err;
  }
}

/**
 * Check payment status dari Gateway
 */
export async function checkPaymentStatus(
  deps: PaymentServiceDeps,
  opts: { userId: string; invoiceId: string },
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: opts.invoiceId, userId: opts.userId },
  });

  if (!invoice) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  }

  // If already paid in our system, return immediately
  if (invoice.status === "paid") {
    return {
      invoiceId: invoice.id,
      status: "paid" as const,
      paidAt: invoice.paidAt?.toISOString(),
      paymentChannel: invoice.gatewayPaymentChannel,
    };
  }

  // If no gateway session, return current status
  if (!invoice.gatewayToken) {
    return {
      invoiceId: invoice.id,
      status: invoice.status,
      message: "Belum ada sesi pembayaran gateway",
    };
  }

  // Check status from Gateway
  const result = await deps.paymentGateway.checkStatus(invoice.uniqueCode);

  if (!result.found) {
    return {
      invoiceId: invoice.id,
      status: invoice.status,
      message: result.error ?? "Status tidak ditemukan di payment gateway",
    };
  }

  // If Gateway says SUCCESS but our DB not updated, process it
  if (result.status === "SUCCESS" && invoice.status !== "paid") {
    const processed = await processSuccessfulPayment(
      invoice.id,
      invoice.userId,
      asInt(invoice.points),
      { paymentChannel: result.paymentChannel, provider: deps.paymentGateway.provider },
    );

    return {
      invoiceId: invoice.id,
      status: "paid" as const,
      paidAt: result.paidAt?.toISOString(),
      paymentChannel: result.paymentChannel,
      message: processed.message,
    };
  }

  if (result.status === "EXPIRED") {
    // Update invoice jika expired di Gateway
    if (invoice.status === "unpaid") {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "expired" },
      });
    }

    return {
      invoiceId: invoice.id,
      status: "expired" as const,
      message: "Sesi pembayaran telah kedaluwarsa",
    };
  }

  return {
    invoiceId: invoice.id,
    status: result.status?.toLowerCase() ?? invoice.status,
    paymentChannel: result.paymentChannel,
  };
}

/**
 * Get invoice dengan info Gateway untuk frontend
 */
export async function getInvoiceWithPaymentInfo(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
  });

  if (!invoice) {
    throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  }

  const now = new Date();
  const isPaymentSessionActive =
    invoice.gatewayPaymentUrl &&
    invoice.gatewayExpiredAt &&
    invoice.gatewayExpiredAt > now;

  return {
    id: invoice.id,
    uniqueCode: invoice.uniqueCode,
    amountIdr: asInt(invoice.amountIdr),
    points: asInt(invoice.points),
    status: invoice.status,
    paymentMethod: invoice.paymentMethod,

    // Gateway payment info
    gateway: isPaymentSessionActive
      ? {
          provider: invoice.paymentGateway,
          paymentUrl: invoice.gatewayPaymentUrl,
          tokenId: invoice.gatewayToken,
          expiredAt: invoice.gatewayExpiredAt?.toISOString(),
          paymentChannel: invoice.gatewayPaymentChannel,
        }
      : null,

    // Manual payment info
    hasProof: Boolean(invoice.proofStorageKey),
    proofSubmittedAt: invoice.proofSubmittedAt?.toISOString() ?? null,
    reviewNote: invoice.reviewNote,

    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
  };
}
