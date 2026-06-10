import { describe, expect, it } from "vitest";
import {
  computeDailyInterest,
  computeDebt,
  type LedgerEntryLike,
} from "./interest";

const day = (n: number) => new Date(Date.UTC(2026, 5, n)); // June 2026

function entry(
  type: LedgerEntryLike["type"],
  amount: number,
  createdAt: Date,
): LedgerEntryLike {
  return { type, amount, createdAt };
}

const INTEREST_CFG = { dailyRate: 0.05, capMultiplier: 3 };

describe("computeDebt — FIFO payment application", () => {
  it("empty ledger → zero everything", () => {
    const d = computeDebt([]);
    expect(d.outstanding).toBe(0);
    expect(d.oldestUnpaidAt).toBeNull();
  });

  it("outstanding = accruals + bets + interest − payments, floored at 0", () => {
    const d = computeDebt([
      entry("ACCRUAL", 100, day(1)),
      entry("BET", 20, day(2)),
      entry("INTEREST", 6, day(3)),
      entry("PAYMENT", 50, day(4)),
    ]);
    expect(d.outstanding).toBe(76);
    expect(d.totalPaid).toBe(50);
  });

  it("overpayment floors at 0 (a rep is a rep, but no credit line)", () => {
    const d = computeDebt([
      entry("ACCRUAL", 30, day(1)),
      entry("PAYMENT", 100, day(2)),
    ]);
    expect(d.outstanding).toBe(0);
    expect(d.oldestUnpaidAt).toBeNull();
  });

  it("payments retire the oldest debt first", () => {
    const d = computeDebt([
      entry("ACCRUAL", 40, day(1)),
      entry("ACCRUAL", 60, day(5)),
      entry("PAYMENT", 50, day(6)),
    ]);
    // 40 fully paid, 10 of the second
    expect(d.outstanding).toBe(50);
    expect(d.oldestUnpaidAt).toEqual(day(5));
  });

  it("splits unpaid principal vs unpaid interest after FIFO", () => {
    const d = computeDebt([
      entry("ACCRUAL", 100, day(1)),
      entry("INTEREST", 5, day(2)),
      entry("ACCRUAL", 50, day(3)),
      entry("PAYMENT", 100, day(4)),
    ]);
    // FIFO: 100 payment kills the day-1 accrual entirely
    expect(d.unpaidPrincipal).toBe(50);
    expect(d.unpaidInterest).toBe(5);
    expect(d.outstanding).toBe(55);
  });

  it("payment order is by pool, not by timing relative to debits", () => {
    // A payment made before any debt still offsets later debt
    const d = computeDebt([
      entry("PAYMENT", 25, day(1)),
      entry("ACCRUAL", 40, day(2)),
    ]);
    expect(d.outstanding).toBe(15);
  });
});

describe("computeDailyInterest", () => {
  it("5% of outstanding, rounded up", () => {
    const e = [entry("ACCRUAL", 101, day(1))];
    // 5.05 → 6
    expect(computeDailyInterest(e, INTEREST_CFG)).toBe(6);
  });

  it("zero debt → zero interest", () => {
    const e = [entry("ACCRUAL", 50, day(1)), entry("PAYMENT", 50, day(2))];
    expect(computeDailyInterest(e, INTEREST_CFG)).toBe(0);
  });

  it("interest compounds (accrues on unpaid interest too)", () => {
    const e = [entry("ACCRUAL", 100, day(1)), entry("INTEREST", 5, day(2))];
    // 5% of 105 = 5.25 → 6
    expect(computeDailyInterest(e, INTEREST_CFG)).toBe(6);
  });

  it("cap: lifetime interest never exceeds principal × (cap − 1)", () => {
    // principal 100, cap 3 → max lifetime interest 200
    const e: LedgerEntryLike[] = [entry("ACCRUAL", 100, day(1))];
    let total = 0;
    for (let d = 2; d < 200; d++) {
      const i = computeDailyInterest(e, INTEREST_CFG);
      if (i === 0) break;
      total += i;
      e.push(entry("INTEREST", i, day(d)));
    }
    expect(total).toBe(200);
    expect(computeDailyInterest(e, INTEREST_CFG)).toBe(0);
  });

  it("cap is on lifetime interest — paying debt off does not reopen headroom", () => {
    const e = [
      entry("ACCRUAL", 100, day(1)),
      entry("INTEREST", 200, day(2)), // cap fully consumed
      entry("PAYMENT", 250, day(3)),
    ];
    expect(computeDailyInterest(e, INTEREST_CFG)).toBe(0);
  });

  it("last interest tick is clipped to exactly hit the cap", () => {
    const e = [
      entry("ACCRUAL", 100, day(1)),
      entry("INTEREST", 198, day(2)),
    ];
    // uncapped would be ceil(298×0.05)=15, but only 2 of headroom remain
    expect(computeDailyInterest(e, INTEREST_CFG)).toBe(2);
  });

  it("respects custom rate and cap", () => {
    const e = [entry("ACCRUAL", 100, day(1))];
    expect(computeDailyInterest(e, { dailyRate: 0.1, capMultiplier: 2 })).toBe(10);
    const maxed = [entry("ACCRUAL", 100, day(1)), entry("INTEREST", 100, day(2))];
    expect(computeDailyInterest(maxed, { dailyRate: 0.1, capMultiplier: 2 })).toBe(0);
  });
});
