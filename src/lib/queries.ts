import { db } from "@/lib/db";
import { computeDebt, type DebtBreakdown } from "@/lib/engine/interest";

export interface LeaderboardRow extends DebtBreakdown {
  memberId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "ADMIN" | "PLAYER";
  handicapMultiplier: number;
}

/**
 * Members ranked by outstanding debt ascending — least owed is winning.
 * Ties go to whoever has paid more (grinders deserve it).
 */
export async function getLeaderboard(tournamentId: string): Promise<LeaderboardRow[]> {
  const members = await db.member.findMany({
    where: { tournamentId },
    include: {
      user: true,
      ledgerEntries: {
        select: { amount: true, type: true, createdAt: true },
      },
    },
  });

  return members
    .map((m) => ({
      memberId: m.id,
      userId: m.userId,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      handicapMultiplier: m.handicapMultiplier,
      ...computeDebt(m.ledgerEntries),
    }))
    .sort((a, b) => a.outstanding - b.outstanding || b.totalPaid - a.totalPaid);
}

export async function getMemberDebt(memberId: string): Promise<DebtBreakdown> {
  const entries = await db.ledgerEntry.findMany({
    where: { memberId },
    select: { amount: true, type: true, createdAt: true },
  });
  return computeDebt(entries);
}
