"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/users";
import { parsePentixConfig } from "@/lib/config";
import { shootoutAmount } from "@/lib/engine/accrual";
import { betOutcome, betTermsLabel, type BetTermsKey } from "@/lib/engine/bets";

function revalidateMatch(tournamentId: string, matchId: string) {
  revalidatePath(`/t/${tournamentId}/match/${matchId}`);
  revalidatePath(`/t/${tournamentId}/matches`);
  revalidatePath(`/t/${tournamentId}`);
}

export async function startMatch(matchId: string) {
  const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
  await requireAdmin(match.tournamentId);
  if (match.status !== "UPCOMING") return;
  await db.match.update({ where: { id: matchId }, data: { status: "LIVE" } });
  revalidateMatch(match.tournamentId, matchId);
}

/** Assign teams (and optionally kickoff) to a knockout TBD match. */
export async function setMatchTeams(matchId: string, formData: FormData) {
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { tournament: true },
  });
  await requireAdmin(match.tournamentId);
  if (match.status === "FINISHED") return;

  const homeTeamId = Number(formData.get("homeTeamId")) || null;
  const awayTeamId = Number(formData.get("awayTeamId")) || null;
  if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
    throw new Error("Ista ekipa na obje strane.");
  }
  const kickoffRaw = String(formData.get("kickoff") ?? "");
  // datetime-local arrives without zone; treat as Europe/Zagreb wall time is
  // overkill here — admins enter it for ordering, store as provided (UTC).
  const kickoff = kickoffRaw ? new Date(kickoffRaw) : null;

  const mainId = match.tournament.mainCountryId;
  const involvesMain = homeTeamId === mainId || awayTeamId === mainId;

  await db.match.update({
    where: { id: matchId },
    data: {
      homeTeamId,
      awayTeamId,
      homeSlot: homeTeamId ? null : match.homeSlot,
      awaySlot: awayTeamId ? null : match.awaySlot,
      ...(kickoff && !isNaN(kickoff.getTime()) ? { kickoff } : {}),
      // auto-track when the main country enters the bracket slot
      ...(involvesMain ? { isTracked: true } : {}),
    },
  });
  revalidateMatch(match.tournamentId, matchId);
}

export async function toggleTracked(matchId: string) {
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { goals: { select: { id: true }, take: 1 } },
  });
  await requireAdmin(match.tournamentId);
  if (match.goals.length > 0) {
    throw new Error("Utakmica već ima golove — praćenje se više ne mijenja.");
  }
  await db.match.update({
    where: { id: matchId },
    data: { isTracked: !match.isTracked },
  });
  revalidateMatch(match.tournamentId, matchId);
}

/**
 * Finish a match: confirm the final score, optionally record a shootout
 * (debt for everyone!), auto-resolve resolvable bets, expire unanswered ones.
 */
export async function finishMatch(matchId: string, formData: FormData) {
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      tournament: { include: { mainCountry: true } },
      homeTeam: true,
      awayTeam: true,
      bets: { include: { proposer: { include: { user: true } }, opponent: { include: { user: true } } } },
    },
  });
  await requireAdmin(match.tournamentId);
  if (match.status === "FINISHED") return;

  const homeScore = Math.max(0, Number(formData.get("homeScore")) || 0);
  const awayScore = Math.max(0, Number(formData.get("awayScore")) || 0);
  const wentToShootout = formData.get("wentToShootout") === "on";
  const homePens = wentToShootout ? Math.max(0, Number(formData.get("homePens")) || 0) : null;
  const awayPens = wentToShootout ? Math.max(0, Number(formData.get("awayPens")) || 0) : null;
  const shootoutMisses = wentToShootout
    ? Math.max(0, Number(formData.get("shootoutMisses")) || 0)
    : 0;

  const cfg = parsePentixConfig(match.tournament.config);
  const mainId = match.tournament.mainCountryId;
  const mainIsHome =
    match.homeTeamId === mainId ? true : match.awayTeamId === mainId ? false : null;

  const members = await db.member.findMany({
    where: { tournamentId: match.tournamentId },
  });

  await db.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: "FINISHED",
        homeScore,
        awayScore,
        wentToShootout,
        homePens,
        awayPens,
      },
    });

    // Shootout — collective suffering, handicap applies (it's an accrual)
    if (match.isTracked && wentToShootout && cfg.shootout.enabled) {
      const homeName = match.homeTeam?.name ?? "Domaći";
      const awayName = match.awayTeam?.name ?? "Gosti";
      const reason =
        `🥅 Jedanaesterci: ${homeName} ${homePens ?? 0}–${awayPens ?? 0} ${awayName}` +
        (shootoutMisses > 0 ? ` · ${shootoutMisses} promašaja` : "");
      const entries = members
        .map((m) => ({
          memberId: m.id,
          amount: shootoutAmount(cfg, shootoutMisses, m.handicapMultiplier),
          type: "ACCRUAL" as const,
          reason,
        }))
        .filter((e) => e.amount > 0);
      if (entries.length > 0) await tx.ledgerEntry.createMany({ data: entries });
    }

    // Bets: resolve ACCEPTED where possible, expire still-PROPOSED ones
    const names = {
      home: match.homeTeam?.name ?? "Domaći",
      away: match.awayTeam?.name ?? "Gosti",
      main: match.tournament.mainCountry.name,
    };
    for (const bet of match.bets) {
      if (bet.status === "PROPOSED") {
        await tx.bet.update({ where: { id: bet.id }, data: { status: "DECLINED" } });
        continue;
      }
      if (bet.status !== "ACCEPTED") continue;

      const outcome = betOutcome(bet.terms as BetTermsKey, {
        homeScore,
        awayScore,
        mainIsHome,
      });
      if (outcome === null) continue; // CUSTOM — admin resolves manually

      const winner = outcome ? bet.proposer : bet.opponent;
      const loser = outcome ? bet.opponent : bet.proposer;
      await tx.bet.update({
        where: { id: bet.id },
        data: { status: "RESOLVED", winnerMemberId: winner.id },
      });
      await tx.ledgerEntry.create({
        data: {
          memberId: loser.id,
          amount: bet.stakeReps, // flat — never scaled by handicap
          type: "BET",
          betId: bet.id,
          reason: `🎲 Oklada protiv ${winner.user.displayName}: "${betTermsLabel(
            bet.terms as BetTermsKey,
            names,
            bet.customText,
          )}"`,
        },
      });
    }
  });

  revalidateMatch(match.tournamentId, matchId);
}
