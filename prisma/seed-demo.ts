/**
 * Demo data for local showcasing (pairs with DEV_AUTH_BYPASS=1):
 *   npx tsx prisma/seed-demo.ts
 *
 * Creates the "Sklekovi za vatrene" tournament with four members, a LIVE
 * Engleska–Hrvatska match with two logged goals, payments, interest and an
 * active bet — using the real accrual engine for all amounts. Idempotent:
 * re-running rebuilds the demo tournament from scratch.
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_CONFIG } from "../src/lib/config";
import {
  computeGoalBase,
  goalSide,
  memberAccrualAmount,
} from "../src/lib/engine/accrual";

const prisma = new PrismaClient();

const INVITE = "VATRENI1";
const DEV_CLERK_ID = "dev_local_user"; // must match src/lib/auth.ts

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function main() {
  // wipe a previous demo run (cascades: members → ledger/sets, matches → goals/bets)
  const existing = await prisma.tournament.findUnique({ where: { inviteCode: INVITE } });
  if (existing) {
    await prisma.tournament.delete({ where: { id: existing.id } });
    console.log("removed previous demo tournament");
  }

  const [antonio, marko, ivan, luka] = await Promise.all(
    [
      { clerkId: DEV_CLERK_ID, displayName: "Antonio" },
      { clerkId: "demo_marko", displayName: "Marko" },
      { clerkId: "demo_ivan", displayName: "Ivan" },
      { clerkId: "demo_luka", displayName: "Luka" },
    ].map((u) =>
      prisma.user.upsert({
        where: { clerkId: u.clerkId },
        update: { displayName: u.displayName },
        create: u,
      }),
    ),
  );

  const croatia = await prisma.team.findUniqueOrThrow({ where: { id: 46 } });

  const tournament = await prisma.tournament.create({
    data: {
      name: "Sklekovi za vatrene",
      mainCountryId: croatia.id,
      config: DEFAULT_CONFIG,
      ownerId: antonio.id,
      status: "ACTIVE",
      inviteCode: INVITE,
    },
  });

  const memberData = [
    { user: antonio, handicap: 1.0, role: "ADMIN" as const },
    { user: marko, handicap: 1.2, role: "PLAYER" as const },
    { user: ivan, handicap: 1.0, role: "PLAYER" as const },
    { user: luka, handicap: 1.5, role: "PLAYER" as const },
  ];
  const members = [];
  for (const m of memberData) {
    members.push(
      await prisma.member.create({
        data: {
          userId: m.user.id,
          tournamentId: tournament.id,
          handicapMultiplier: m.handicap,
          role: m.role,
        },
      }),
    );
  }
  const [mAntonio, mMarko, , mLuka] = members;

  // copy the full 104-match schedule
  const template = await prisma.templateMatch.findMany({ orderBy: { id: "asc" } });
  await prisma.match.createMany({
    data: template.map((t) => ({
      tournamentId: tournament.id,
      templateMatchId: t.id,
      phase: t.phase,
      homeTeamId: t.homeTeamId,
      awayTeamId: t.awayTeamId,
      homeSlot: t.homeSlot,
      awaySlot: t.awaySlot,
      kickoff: t.kickoff,
      stadiumId: t.stadiumId,
      groupLetter: t.groupLetter,
      isTracked: t.homeTeamId === croatia.id || t.awayTeamId === croatia.id,
    })),
  });

  // ── make Engleska–Hrvatska (official match 22) LIVE with two goals ────────
  const engCro = await prisma.match.findUniqueOrThrow({
    where: {
      tournamentId_templateMatchId: {
        tournamentId: tournament.id,
        templateMatchId: 22,
      },
    },
  });
  await prisma.match.update({
    where: { id: engCro.id },
    data: { status: "LIVE", kickoff: minutesAgo(50), homeScore: 1, awayScore: 1 },
  });

  const demoGoals = [
    {
      scoringTeamId: 45, // Engleska
      scorerName: "Kane",
      minute: 23,
      isPenalty: false,
      isLate: false,
      createdAt: minutesAgo(27),
      reason: "⚽ Kane 23' (Engleska) · primljeni",
    },
    {
      scoringTeamId: 46, // Hrvatska
      scorerName: "Kramarić",
      minute: 41,
      isPenalty: false,
      isLate: false,
      createdAt: minutesAgo(9),
      reason: "⚽ Kramarić 41' (Hrvatska)",
    },
  ];

  for (const g of demoGoals) {
    const side = goalSide({
      scoringTeamId: g.scoringTeamId,
      mainCountryId: croatia.id,
      homeTeamId: 45,
      awayTeamId: 46,
    });
    const base = computeGoalBase(DEFAULT_CONFIG, {
      phase: "GROUP",
      side,
      scorerName: g.scorerName,
      isPenalty: g.isPenalty,
      isOwnGoal: false,
      isLate: g.isLate,
      nthGoalBySamePlayer: 1,
    });
    const goal = await prisma.goal.create({
      data: {
        matchId: engCro.id,
        scoringTeamId: g.scoringTeamId,
        scorerName: g.scorerName,
        minute: g.minute,
        isPenalty: g.isPenalty,
        isLate: g.isLate,
        createdAt: g.createdAt,
      },
    });
    await prisma.ledgerEntry.createMany({
      data: members.map((m) => ({
        memberId: m.id,
        amount: memberAccrualAmount(base.base, m.handicapMultiplier),
        type: "ACCRUAL" as const,
        reason: g.reason,
        goalId: goal.id,
        createdAt: g.createdAt,
      })),
    });
  }

  // ── payments (sets recorded earlier today) ────────────────────────────────
  const payments = [
    { member: mAntonio, reps: 20, cvReps: 19, conf: 0.93, at: minutesAgo(15) },
    { member: mMarko, reps: 35, cvReps: 35, conf: 0.88, at: minutesAgo(6) },
    { member: mLuka, reps: 10, cvReps: 11, conf: 0.71, at: minutesAgo(3) },
  ];
  for (const p of payments) {
    const set = await prisma.pushupSet.create({
      data: {
        memberId: p.member.id,
        reps: p.reps,
        cvReps: p.cvReps,
        cvConfidence: p.conf,
        createdAt: p.at,
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        memberId: p.member.id,
        amount: p.reps,
        type: "PAYMENT",
        reason:
          p.reps === p.cvReps
            ? `💪 ${p.reps} sklekova (potvrdila kamera)`
            : `💪 ${p.reps} sklekova (kamera: ${p.cvReps})`,
        pushupSetId: set.id,
        createdAt: p.at,
      },
    });
  }

  // ── a bet on the live match ───────────────────────────────────────────────
  await prisma.bet.create({
    data: {
      matchId: engCro.id,
      proposerMemberId: mMarko.id,
      opponentMemberId: mAntonio.id,
      stakeReps: 20,
      terms: "MAIN_WIN",
      status: "ACCEPTED",
      createdAt: minutesAgo(40),
    },
  });

  console.log(`✓ demo tournament "${tournament.name}" (invite ${INVITE})`);
  console.log("  members: Antonio (admin, ti), Marko ×1.2, Ivan, Luka ×1.5");
  console.log("  Engleska–Hrvatska LIVE 1:1 (Kane 23', Kramarić 41')");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
