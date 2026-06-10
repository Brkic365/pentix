/**
 * Pure debt/interest math — no I/O, no Prisma.
 *
 * Payments are applied FIFO against debt entries in chronological order, so
 * interest only ever accrues on what is genuinely unpaid, and the UI can show
 * how much of the outstanding debt is principal vs. accumulated interest.
 */

export type LedgerTypeLike = "ACCRUAL" | "PAYMENT" | "BET" | "INTEREST";

export interface LedgerEntryLike {
  amount: number; // whole pushups, >= 0
  type: LedgerTypeLike;
  createdAt: Date;
}

export interface DebtBreakdown {
  /** Σ(ACCRUAL+BET+INTEREST) − Σ(PAYMENT), floored at 0 */
  outstanding: number;
  /** portion of outstanding that is principal (ACCRUAL+BET), after FIFO payments */
  unpaidPrincipal: number;
  /** portion of outstanding that is interest, after FIFO payments */
  unpaidInterest: number;
  totalPaid: number;
  /** Σ ACCRUAL+BET ever charged ("original principal") */
  lifetimePrincipal: number;
  /** Σ INTEREST ever charged */
  lifetimeInterest: number;
  /** createdAt of the oldest debt entry not yet fully paid off */
  oldestUnpaidAt: Date | null;
}

export function computeDebt(entries: LedgerEntryLike[]): DebtBreakdown {
  const debits = entries
    .filter((e) => e.type !== "PAYMENT")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const totalPaid = entries
    .filter((e) => e.type === "PAYMENT")
    .reduce((sum, e) => sum + e.amount, 0);

  let pool = totalPaid;
  let unpaidPrincipal = 0;
  let unpaidInterest = 0;
  let oldestUnpaidAt: Date | null = null;

  for (const d of debits) {
    const consumed = Math.min(pool, d.amount);
    pool -= consumed;
    const remaining = d.amount - consumed;
    if (remaining > 0) {
      if (d.type === "INTEREST") unpaidInterest += remaining;
      else unpaidPrincipal += remaining;
      if (oldestUnpaidAt === null) oldestUnpaidAt = d.createdAt;
    }
  }

  const lifetimePrincipal = debits
    .filter((d) => d.type !== "INTEREST")
    .reduce((sum, d) => sum + d.amount, 0);
  const lifetimeInterest = debits
    .filter((d) => d.type === "INTEREST")
    .reduce((sum, d) => sum + d.amount, 0);

  return {
    outstanding: unpaidPrincipal + unpaidInterest,
    unpaidPrincipal,
    unpaidInterest,
    totalPaid,
    lifetimePrincipal,
    lifetimeInterest,
    oldestUnpaidAt,
  };
}

export interface InterestConfigLike {
  dailyRate: number;
  capMultiplier: number;
}

/**
 * One day of interest for a member, in whole pushups (rounded UP — the loan
 * shark always rounds in his own favour).
 *
 * Cap: lifetime interest may never push total lifetime debt above
 * lifetimePrincipal × capMultiplier, i.e. Σ INTEREST ≤ principal × (cap − 1).
 */
export function computeDailyInterest(
  entries: LedgerEntryLike[],
  cfg: InterestConfigLike,
): number {
  const { outstanding, lifetimePrincipal, lifetimeInterest } = computeDebt(entries);
  if (outstanding <= 0) return 0;

  const uncapped = Math.ceil(outstanding * cfg.dailyRate);
  const maxLifetimeInterest = Math.max(
    0,
    Math.floor(lifetimePrincipal * (cfg.capMultiplier - 1)),
  );
  return Math.max(0, Math.min(uncapped, maxLifetimeInterest - lifetimeInterest));
}
