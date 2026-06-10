import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parsePentixConfig } from "@/lib/config";
import { computeDailyInterest, computeDebt } from "@/lib/engine/interest";

export const dynamic = "force-dynamic";

/**
 * Daily interest job (Vercel Cron, see vercel.json). For every member of an
 * ACTIVE tournament with outstanding debt, add an INTEREST entry of
 * outstanding × dailyRate (rounded up), capped so lifetime interest never
 * exceeds principal × (capMultiplier − 1). FINISHED tournaments stop ticking
 * — the game is over, the bill is frozen.
 *
 * Idempotent per UTC day: a member is skipped if they already have an
 * INTEREST entry today, so double-fired crons don't double-charge.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const tournaments = await db.tournament.findMany({
    where: { status: "ACTIVE" },
    include: {
      members: {
        include: {
          ledgerEntries: { select: { amount: true, type: true, createdAt: true } },
        },
      },
    },
  });

  let membersCharged = 0;
  let totalInterest = 0;

  for (const t of tournaments) {
    const cfg = parsePentixConfig(t.config);
    const pct = Math.round(cfg.interest.dailyRate * 1000) / 10;

    for (const m of t.members) {
      const alreadyChargedToday = m.ledgerEntries.some(
        (e) => e.type === "INTEREST" && e.createdAt >= startOfUtcDay,
      );
      if (alreadyChargedToday) continue;

      const interest = computeDailyInterest(m.ledgerEntries, cfg.interest);
      if (interest <= 0) continue;

      const { outstanding } = computeDebt(m.ledgerEntries);
      await db.ledgerEntry.create({
        data: {
          memberId: m.id,
          amount: interest,
          type: "INTEREST",
          reason: `🩸 Kamata ${pct}% na dug od ${outstanding}`,
        },
      });
      membersCharged += 1;
      totalInterest += interest;
    }
  }

  return NextResponse.json({ ok: true, membersCharged, totalInterest });
}
