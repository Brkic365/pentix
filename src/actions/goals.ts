"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/users";
import { parsePentixConfig } from "@/lib/config";
import { sendPush } from "@/lib/push";
import {
  computeGoalBase,
  goalSide,
  memberAccrualAmount,
  normalizeName,
} from "@/lib/engine/accrual";

/**
 * The debt trigger. Admin taps GOAL → this creates the Goal row, bumps the
 * score, and writes one ACCRUAL LedgerEntry per member — atomically.
 */
export async function logGoal(matchId: string, formData: FormData) {
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      tournament: { include: { mainCountry: true } },
      homeTeam: true,
      awayTeam: true,
      goals: true,
    },
  });
  await requireAdmin(match.tournamentId);

  if (match.tournament.status !== "ACTIVE") {
    throw new Error("Turnir nije aktivan.");
  }
  if (!match.isTracked) {
    throw new Error("Ova utakmica se ne prati — golovi ne prave dug.");
  }
  if (match.status === "FINISHED") {
    throw new Error("Utakmica je završena.");
  }

  const scoringTeamId = Number(formData.get("scoringTeamId"));
  if (scoringTeamId !== match.homeTeamId && scoringTeamId !== match.awayTeamId) {
    throw new Error("Ekipa nije u ovoj utakmici.");
  }
  const scorerName = String(formData.get("scorerName") ?? "").trim() || "Nepoznat";
  const minute = Math.max(1, Math.min(130, Number(formData.get("minute")) || 1));
  const isPenalty = formData.get("isPenalty") === "on";
  const isOwnGoal = formData.get("isOwnGoal") === "on";
  const isLate = formData.get("isLate") === "on";

  const cfg = parsePentixConfig(match.tournament.config);
  const mainCountryId = match.tournament.mainCountryId;

  // Hat-trick counter: real (non-own) goals by the same scorer for the same team
  const nthGoalBySamePlayer = isOwnGoal
    ? 1
    : match.goals.filter(
        (g) =>
          !g.isOwnGoal &&
          g.scoringTeamId === scoringTeamId &&
          normalizeName(g.scorerName) === normalizeName(scorerName),
      ).length + 1;

  const side = goalSide({
    scoringTeamId,
    mainCountryId,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
  });

  const breakdown = computeGoalBase(cfg, {
    phase: match.phase,
    side,
    scorerName,
    isPenalty,
    isOwnGoal,
    isLate,
    nthGoalBySamePlayer,
  });

  const scoringTeamName =
    scoringTeamId === match.homeTeamId
      ? (match.homeTeam?.name ?? "Domaći")
      : (match.awayTeam?.name ?? "Gosti");

  const tags = [
    side === "AGAINST" ? "primljeni" : null,
    isOwnGoal ? "autogol" : null,
    isPenalty ? "penal" : null,
    isLate ? "kasni gol" : null,
    breakdown.hatTrickApplied ? "hat-trick ×2" : null,
    breakdown.favoritePlayerApplied ? `${cfg.flatBonuses.favoritePlayerName} bonus` : null,
  ].filter(Boolean);
  const reason =
    `⚽ ${scorerName} ${minute}' (${scoringTeamName})` +
    (tags.length ? ` · ${tags.join(" · ")}` : "");

  const members = await db.member.findMany({
    where: { tournamentId: match.tournamentId },
  });

  await db.$transaction(async (tx) => {
    const goal = await tx.goal.create({
      data: {
        matchId,
        scoringTeamId,
        scorerName,
        minute,
        isPenalty,
        isOwnGoal,
        isLate,
        nthGoalBySamePlayer,
      },
    });

    const entries = members
      .map((m) => ({
        memberId: m.id,
        amount: memberAccrualAmount(breakdown.base, m.handicapMultiplier),
        type: "ACCRUAL" as const,
        reason,
        goalId: goal.id,
      }))
      .filter((e) => e.amount > 0);
    if (entries.length > 0) {
      await tx.ledgerEntry.createMany({ data: entries });
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        homeScore: { increment: scoringTeamId === match.homeTeamId ? 1 : 0 },
        awayScore: { increment: scoringTeamId === match.awayTeamId ? 1 : 0 },
        status: match.status === "UPCOMING" ? "LIVE" : match.status,
      },
    });
  });

  await sendPush(
    members
      .map((m) => ({
        userId: m.userId,
        title: `⚽ ${scorerName} ${minute}′ (${scoringTeamName})`,
        body: `+${memberAccrualAmount(breakdown.base, m.handicapMultiplier)} sklekova za tebe · ${match.tournament.name}`,
        url: `/t/${match.tournamentId}/match/${matchId}`,
        tag: `goal-${matchId}`,
      }))
      .filter((p) => !p.body.startsWith("+0 ")),
  );

  revalidatePath(`/t/${match.tournamentId}/match/${matchId}`);
  revalidatePath(`/t/${match.tournamentId}`);
}

/**
 * Undo for fat fingers: removes the most recent goal of the match together
 * with all debt it generated, and rolls the score back.
 */
export async function deleteLastGoal(matchId: string) {
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { goals: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  await requireAdmin(match.tournamentId);

  const last = match.goals[0];
  if (!last) return;

  await db.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany({ where: { goalId: last.id } });
    await tx.goal.delete({ where: { id: last.id } });
    await tx.match.update({
      where: { id: matchId },
      data: {
        homeScore: {
          decrement:
            last.scoringTeamId === match.homeTeamId && match.homeScore > 0 ? 1 : 0,
        },
        awayScore: {
          decrement:
            last.scoringTeamId === match.awayTeamId && match.awayScore > 0 ? 1 : 0,
        },
      },
    });
  });

  revalidatePath(`/t/${match.tournamentId}/match/${matchId}`);
  revalidatePath(`/t/${match.tournamentId}`);
}
