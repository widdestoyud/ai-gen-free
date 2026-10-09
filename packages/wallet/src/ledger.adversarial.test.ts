import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@ai-gen-free/db";
import { LedgerStatus, LedgerType, Prisma } from "@prisma/client";
import { computeBalance, holdForJob, captureJob, releaseJob } from "./ledger.js";

// Independent mathematical oracle that calculates balance from raw entries
function oracleBalance(entries: Array<{ type: LedgerType; status: LedgerStatus; amount: number }>) {
  let postedNet = 0;
  let held = 0;
  for (const e of entries) {
    const amt = Number(e.amount);
    if (e.status === LedgerStatus.posted) {
      if (e.type === LedgerType.topup || e.type === LedgerType.refund || e.type === LedgerType.adjust) {
        postedNet += amt;
      } else if (e.type === LedgerType.capture) {
        postedNet -= amt;
      }
      // release does not change postedNet
    } else if (e.status === LedgerStatus.pending && e.type === LedgerType.hold) {
      held += amt;
    }
  }
  return { available: postedNet - held, held, postedNet };
}

describe("Ledger computeBalance Adversarial Stress Tests", () => {
  const createdUserIds: string[] = [];

  async function createTestUser(tag: string): Promise<string> {
    const email = `adversarial-ledger-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        wallet: {
          create: {
            availableCached: 0,
          },
        },
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  after(async () => {
    // Clean up created test users, jobs, and ledger entries
    if (createdUserIds.length > 0) {
      await prisma.ledgerEntry.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.job.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.wallet.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  test("1. Empty ledger produces exact zero balances", async () => {
    const userId = await createTestUser("empty");
    const bal = await computeBalance(userId);

    assert.equal(bal.available, 0, "Available must be 0 for empty ledger");
    assert.equal(bal.held, 0, "Held must be 0 for empty ledger");
    assert.equal(bal.postedNet, 0, "PostedNet must be 0 for empty ledger");
  });

  test("2. Single topup updates available and postedNet identically", async () => {
    const userId = await createTestUser("topup");
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: LedgerType.topup,
        status: LedgerStatus.posted,
        amount: 1500,
        idempotencyKey: `topup:${userId}:1`,
      },
    });

    const bal = await computeBalance(userId);
    assert.equal(bal.available, 1500);
    assert.equal(bal.held, 0);
    assert.equal(bal.postedNet, 1500);
  });

  test("3. Pending hold reduces available balance and increases held balance", async () => {
    const userId = await createTestUser("hold");
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: LedgerType.topup,
        status: LedgerStatus.posted,
        amount: 2000,
        idempotencyKey: `topup:${userId}:1`,
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: LedgerType.hold,
        status: LedgerStatus.pending,
        amount: 450,
        idempotencyKey: `hold:${userId}:1`,
      },
    });

    const bal = await computeBalance(userId);
    assert.equal(bal.postedNet, 2000);
    assert.equal(bal.held, 450);
    assert.equal(bal.available, 1550);
  });

  test("4. Hold release returns held points back to available balance", async () => {
    const userId = await createTestUser("release");
    const job = await prisma.job.create({
      data: {
        userId,
        mode: "t2i",
        cost: 300,
        modelId: "flux-schnell",
        providerId: "siray",
        prompt: "test job for hold release",
      },
    });
    const jobId = job.id;
    
    // Topup
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: LedgerType.topup,
        status: LedgerStatus.posted,
        amount: 1000,
        idempotencyKey: `topup:${userId}:1`,
      },
    });
    // Hold via holdForJob
    await holdForJob({ userId, jobId, amount: 300 });

    const balHeld = await computeBalance(userId);
    assert.equal(balHeld.available, 700);
    assert.equal(balHeld.held, 300);
    assert.equal(balHeld.postedNet, 1000);

    // Release via releaseJob
    const releaseRes = await releaseJob({ userId, jobId, amount: 300 });
    assert.equal(releaseRes.idempotent, false);

    const balReleased = await computeBalance(userId);
    assert.equal(balReleased.available, 1000, "Available balance restored upon release");
    assert.equal(balReleased.held, 0, "Held balance cleared to 0");
    assert.equal(balReleased.postedNet, 1000, "PostedNet unchanged by release");
  });

  test("5. Hold capture deducts points and clears held balance", async () => {
    const userId = await createTestUser("capture");
    const job = await prisma.job.create({
      data: {
        userId,
        mode: "t2i",
        cost: 300,
        modelId: "flux-schnell",
        providerId: "siray",
        prompt: "test job for hold capture",
      },
    });
    const jobId = job.id;

    // Topup
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: LedgerType.topup,
        status: LedgerStatus.posted,
        amount: 1000,
        idempotencyKey: `topup:${userId}:1`,
      },
    });
    // Hold
    await holdForJob({ userId, jobId, amount: 300 });
    // Capture
    const capRes = await captureJob({ userId, jobId, amount: 300 });
    assert.equal(capRes.idempotent, false);

    const balCaptured = await computeBalance(userId);
    assert.equal(balCaptured.available, 700, "Available balance reflects capture");
    assert.equal(balCaptured.held, 0, "Held balance cleared to 0");
    assert.equal(balCaptured.postedNet, 700, "PostedNet reflects capture deduction");
  });

  test("6. Complex multi-step accounting with adjustments, refunds, and zero balance states", async () => {
    const userId = await createTestUser("complex");

    // Sequence of diverse transactions
    const transactions = [
      { type: LedgerType.topup, status: LedgerStatus.posted, amount: 5000 },
      { type: LedgerType.adjust, status: LedgerStatus.posted, amount: 200 }, // +200 adjustment
      { type: LedgerType.adjust, status: LedgerStatus.posted, amount: -500 }, // -500 adjustment
      { type: LedgerType.refund, status: LedgerStatus.posted, amount: 150 }, // +150 refund
      { type: LedgerType.hold, status: LedgerStatus.pending, amount: 800 }, // 800 pending hold
      { type: LedgerType.hold, status: LedgerStatus.void, amount: 500 }, // void hold (should be ignored)
      { type: LedgerType.capture, status: LedgerStatus.posted, amount: 500 }, // capture 500
      { type: LedgerType.release, status: LedgerStatus.posted, amount: 200 }, // posted release (ignored in postedNet)
      { type: LedgerType.topup, status: LedgerStatus.pending, amount: 1000 }, // pending topup (should be ignored)
    ];

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      await prisma.ledgerEntry.create({
        data: {
          userId,
          type: t.type,
          status: t.status,
          amount: t.amount,
          idempotencyKey: `tx:${userId}:${i}`,
        },
      });
    }

    const expected = oracleBalance(transactions);
    const actual = await computeBalance(userId);

    // postedNet = 5000 + 200 - 500 + 150 - 500 = 4350
    // held = 800
    // available = 4350 - 800 = 3550
    assert.equal(actual.postedNet, expected.postedNet);
    assert.equal(actual.held, expected.held);
    assert.equal(actual.available, expected.available);
    assert.equal(actual.postedNet, 4350);
    assert.equal(actual.held, 800);
    assert.equal(actual.available, 3550);
  });

  test("7. Zero-balance states: exact net zero available and postedNet", async () => {
    const userId = await createTestUser("zero-balance");

    // Topup 1000, then capture 1000
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: LedgerType.topup,
        status: LedgerStatus.posted,
        amount: 1000,
        idempotencyKey: `tx:${userId}:1`,
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: LedgerType.capture,
        status: LedgerStatus.posted,
        amount: 1000,
        idempotencyKey: `tx:${userId}:2`,
      },
    });

    const bal = await computeBalance(userId);
    assert.equal(bal.postedNet, 0);
    assert.equal(bal.held, 0);
    assert.equal(bal.available, 0);
  });

  test("8. Monte Carlo Stress Test: 20 randomized transaction histories against independent oracle", async () => {
    const randomUserIds: string[] = [];

    try {
      for (let run = 0; run < 20; run++) {
        const userId = await createTestUser(`rand-${run}`);
        randomUserIds.push(userId);

        const txCount = 25 + Math.floor(Math.random() * 25); // 25-50 transactions
        const history: Array<{ type: LedgerType; status: LedgerStatus; amount: number }> = [];

        // Seed with initial topup to keep balance non-negative
        const initialTopup = 10000;
        history.push({ type: LedgerType.topup, status: LedgerStatus.posted, amount: initialTopup });

        for (let i = 1; i < txCount; i++) {
          const roll = Math.random();
          if (roll < 0.25) {
            // Topup
            history.push({
              type: LedgerType.topup,
              status: LedgerStatus.posted,
              amount: 100 + Math.floor(Math.random() * 500),
            });
          } else if (roll < 0.45) {
            // Pending hold
            history.push({
              type: LedgerType.hold,
              status: LedgerStatus.pending,
              amount: 50 + Math.floor(Math.random() * 200),
            });
          } else if (roll < 0.65) {
            // Capture
            history.push({
              type: LedgerType.capture,
              status: LedgerStatus.posted,
              amount: 50 + Math.floor(Math.random() * 200),
            });
          } else if (roll < 0.75) {
            // Adjust (positive or negative)
            const delta = Math.floor(Math.random() * 200) - 100;
            if (delta !== 0) {
              history.push({
                type: LedgerType.adjust,
                status: LedgerStatus.posted,
                amount: delta,
              });
            }
          } else if (roll < 0.85) {
            // Refund
            history.push({
              type: LedgerType.refund,
              status: LedgerStatus.posted,
              amount: 25 + Math.floor(Math.random() * 150),
            });
          } else if (roll < 0.95) {
            // Release (posted)
            history.push({
              type: LedgerType.release,
              status: LedgerStatus.posted,
              amount: 50 + Math.floor(Math.random() * 100),
            });
          } else {
            // Void hold
            history.push({
              type: LedgerType.hold,
              status: LedgerStatus.void,
              amount: 100,
            });
          }
        }

        // Insert in bulk
        await prisma.ledgerEntry.createMany({
          data: history.map((h, idx) => ({
            userId,
            type: h.type,
            status: h.status,
            amount: h.amount,
            idempotencyKey: `mc:${userId}:${idx}`,
          })),
        });

        const expected = oracleBalance(history);
        const actual = await computeBalance(userId);

        assert.equal(
          actual.postedNet,
          expected.postedNet,
          `Run ${run}: postedNet mismatch (expected ${expected.postedNet}, got ${actual.postedNet})`,
        );
        assert.equal(
          actual.held,
          expected.held,
          `Run ${run}: held mismatch (expected ${expected.held}, got ${actual.held})`,
        );
        assert.equal(
          actual.available,
          expected.available,
          `Run ${run}: available mismatch (expected ${expected.available}, got ${actual.available})`,
        );
      }
    } finally {
      if (randomUserIds.length > 0) {
        await prisma.ledgerEntry.deleteMany({
          where: { userId: { in: randomUserIds } },
        });
        await prisma.wallet.deleteMany({
          where: { userId: { in: randomUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: randomUserIds } },
        });
      }
    }
  });

  test("9. Transaction isolation: computeBalance with tx reflects in-flight mutations", async () => {
    const userId = await createTestUser("tx-test");

    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: LedgerType.topup,
        status: LedgerStatus.posted,
        amount: 3000,
        idempotencyKey: `tx:${userId}:1`,
      },
    });

    await prisma.$transaction(async (tx) => {
      // In transaction: add pending hold
      await tx.ledgerEntry.create({
        data: {
          userId,
          type: LedgerType.hold,
          status: LedgerStatus.pending,
          amount: 1200,
          idempotencyKey: `tx:${userId}:txhold`,
        },
      });

      const inTxBal = await computeBalance(userId, tx);
      assert.equal(inTxBal.postedNet, 3000);
      assert.equal(inTxBal.held, 1200);
      assert.equal(inTxBal.available, 1800);
    });

    const finalBal = await computeBalance(userId);
    assert.equal(finalBal.available, 1800);
    assert.equal(finalBal.held, 1200);
    assert.equal(finalBal.postedNet, 3000);
  });
});
