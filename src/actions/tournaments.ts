"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/users";
import { generateInviteCode } from "@/lib/invite";
import { DEFAULT_CONFIG, parsePentixConfig, pentixConfigSchema } from "@/lib/config";
import { eliminationAmount, topThreeAmount } from "@/lib/engine/accrual";

const HANDICAP_MIN = 0.5;
const HANDICAP_MAX = 2.0; // spec cap

export async function createTournament(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const mainCountryId = Number(formData.get("mainCountryId"));
  if (!name || !Number.isInteger(mainCountryId)) {
    throw new Error("Naziv i glavna reprezentacija su obavezni.");
  }

  const template = await db.templateMatch.findMany({ orderBy: { id: "asc" } });

  const tournament = await db.$transaction(async (tx) => {
    const t = await tx.tournament.create({
      data: {
        name,
        mainCountryId,
        config: DEFAULT_CONFIG,
        ownerId: user.id,
        status: "ACTIVE",
        inviteCode: generateInviteCode(),
        members: { create: { userId: user.id, role: "ADMIN" } },
      },
    });

    if (template.length > 0) {
      await tx.match.createMany({
        data: template.map((m) => ({
          tournamentId: t.id,
          templateMatchId: m.id,
          phase: m.phase,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeSlot: m.homeSlot,
          awaySlot: m.awaySlot,
          kickoff: m.kickoff,
          stadiumId: m.stadiumId,
          groupLetter: m.groupLetter,
          isTracked:
            m.homeTeamId === mainCountryId || m.awayTeamId === mainCountryId,
        })),
      });
    }
    return t;
  });

  redirect(`/t/${tournament.id}`);
}

export async function joinByCode(formData: FormData) {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return;
  const tournament = await db.tournament.findUnique({ where: { inviteCode: code } });
  if (!tournament) {
    redirect(`/dashboard?error=kod`);
  }
  redirect(`/join/${code}`);
}

export async function updateConfig(tournamentId: string, formData: FormData) {
  await requireAdmin(tournamentId);

  const raw = {
    baseReps: Number(formData.get("baseReps")),
    phaseMultipliers: {
      GROUP: Number(formData.get("pm_GROUP")),
      R32: Number(formData.get("pm_R32")),
      R16: Number(formData.get("pm_R16")),
      QF: Number(formData.get("pm_QF")),
      SF: Number(formData.get("pm_SF")),
      THIRD: Number(formData.get("pm_THIRD")),
      FINAL: Number(formData.get("pm_FINAL")),
    },
    mainTeamGoalMultiplier: Number(formData.get("mainTeamGoalMultiplier")),
    concededGoalMultiplier: Number(formData.get("concededGoalMultiplier")),
    trackNeutralMatches: formData.get("trackNeutralMatches") === "on",
    eliminationPenalty: Number(formData.get("eliminationPenalty")),
    topThreeBonus: {
      first: Number(formData.get("ttb_first")),
      second: Number(formData.get("ttb_second")),
      third: Number(formData.get("ttb_third")),
    },
    flatBonuses: {
      favoritePlayerName: String(formData.get("favoritePlayerName") ?? "").trim(),
      favoritePlayerGoal: Number(formData.get("favoritePlayerGoal")),
      lateGoal: Number(formData.get("lateGoal")),
      penaltyGoal: Number(formData.get("penaltyGoal")),
      hatTrickThirdGoalDoubles: formData.get("hatTrickThirdGoalDoubles") === "on",
    },
    interest: {
      dailyRate: Number(formData.get("interestDailyRate")),
      capMultiplier: Number(formData.get("interestCapMultiplier")),
    },
    shootout: {
      enabled: formData.get("shootoutEnabled") === "on",
      everyoneReps: Number(formData.get("shootoutEveryoneReps")),
      perMissBonus: Number(formData.get("shootoutPerMissBonus")),
    },
  };

  const parsed = pentixConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Neispravne vrijednosti formule.");
  }

  await db.tournament.update({
    where: { id: tournamentId },
    data: { config: parsed.data },
  });
  revalidatePath(`/t/${tournamentId}/settings`);
  revalidatePath(`/t/${tournamentId}`);
}

export async function setMainCountry(tournamentId: string, formData: FormData) {
  await requireAdmin(tournamentId);
  const mainCountryId = Number(formData.get("mainCountryId"));
  if (!Number.isInteger(mainCountryId)) return;

  await db.$transaction(async (tx) => {
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { mainCountryId },
    });
    // Re-derive default tracking for matches that haven't started generating debt
    const matches = await tx.match.findMany({
      where: { tournamentId, status: "UPCOMING", goals: { none: {} } },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    });
    for (const m of matches) {
      await tx.match.update({
        where: { id: m.id },
        data: {
          isTracked:
            m.homeTeamId === mainCountryId || m.awayTeamId === mainCountryId,
        },
      });
    }
  });
  revalidatePath(`/t/${tournamentId}`);
  revalidatePath(`/t/${tournamentId}/settings`);
}

export async function updateMember(tournamentId: string, formData: FormData) {
  const { member: me } = await requireAdmin(tournamentId);
  const memberId = String(formData.get("memberId"));
  const handicapMultiplier = Number(formData.get("handicapMultiplier"));
  const role = String(formData.get("role")) === "ADMIN" ? "ADMIN" : "PLAYER";

  if (
    !Number.isFinite(handicapMultiplier) ||
    handicapMultiplier < HANDICAP_MIN ||
    handicapMultiplier > HANDICAP_MAX
  ) {
    throw new Error(`Handicap mora biti između ${HANDICAP_MIN} i ${HANDICAP_MAX}.`);
  }

  const target = await db.member.findUnique({ where: { id: memberId } });
  if (!target || target.tournamentId !== tournamentId) return;
  // Don't let an admin demote themselves into a locked-out tournament
  const isSelfDemotion = target.id === me.id && role !== "ADMIN";
  await db.member.update({
    where: { id: memberId },
    data: {
      handicapMultiplier,
      role: isSelfDemotion ? "ADMIN" : role,
    },
  });
  revalidatePath(`/t/${tournamentId}/settings`);
}

export async function regenerateInvite(tournamentId: string) {
  await requireAdmin(tournamentId);
  await db.tournament.update({
    where: { id: tournamentId },
    data: { inviteCode: generateInviteCode() },
  });
  revalidatePath(`/t/${tournamentId}/settings`);
}

/**
 * Main country knocked out → one-time collective ACCRUAL of
 * eliminationPenalty × handicap for every member.
 */
export async function applyElimination(tournamentId: string) {
  const { tournament } = await requireAdmin(tournamentId);
  if (tournament.eliminatedAt) return; // already charged

  const cfg = parsePentixConfig(tournament.config);
  const members = await db.member.findMany({ where: { tournamentId } });

  await db.$transaction(async (tx) => {
    const fresh = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { eliminatedAt: true, mainCountry: { select: { name: true } } },
    });
    if (fresh.eliminatedAt) return;
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { eliminatedAt: new Date() },
    });
    await tx.ledgerEntry.createMany({
      data: members.map((m) => ({
        memberId: m.id,
        amount: eliminationAmount(cfg, m.handicapMultiplier),
        type: "ACCRUAL" as const,
        reason: `Ispadanje: ${fresh.mainCountry.name} je ispala 💀`,
      })),
    });
  });
  revalidatePath(`/t/${tournamentId}`);
  revalidatePath(`/t/${tournamentId}/settings`);
}

/**
 * Finish the tournament; placement 1/2/3 applies the top-three bonus to
 * everyone (collective suffering), anything else applies nothing.
 */
export async function finishTournament(tournamentId: string, formData: FormData) {
  const { tournament } = await requireAdmin(tournamentId);
  if (tournament.status === "FINISHED") return;
  const placement = Number(formData.get("placement")); // 0 = no podium

  const cfg = parsePentixConfig(tournament.config);
  const members = await db.member.findMany({ where: { tournamentId } });

  await db.$transaction(async (tx) => {
    const fresh = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { status: true, mainCountry: { select: { name: true } } },
    });
    if (fresh.status === "FINISHED") return;
    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: "FINISHED",
        finalPlacement: [1, 2, 3].includes(placement) ? placement : null,
      },
    });
    if ([1, 2, 3].includes(placement)) {
      const entries = members
        .map((m) => ({
          memberId: m.id,
          amount: topThreeAmount(cfg, placement, m.handicapMultiplier),
          type: "ACCRUAL" as const,
          reason: `Plasman: ${fresh.mainCountry.name} osvojila ${placement}. mjesto 🏆`,
        }))
        .filter((e) => e.amount > 0);
      if (entries.length > 0) {
        await tx.ledgerEntry.createMany({ data: entries });
      }
    }
  });
  revalidatePath(`/t/${tournamentId}`);
  revalidatePath(`/t/${tournamentId}/settings`);
}
