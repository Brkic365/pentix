"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireMember } from "@/lib/users";
import { sendPush } from "@/lib/push";
import { betTermsLabel, type BetTermsKey } from "@/lib/engine/bets";

const TERMS: BetTermsKey[] = [
  "MAIN_WIN",
  "MAIN_NOT_WIN",
  "HOME_WIN",
  "AWAY_WIN",
  "DRAW",
  "OVER_2_5",
  "UNDER_2_5",
  "CUSTOM",
];

const MAX_STAKE = 500;

export async function proposeBet(matchId: string, formData: FormData) {
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { tournament: true },
  });
  const { member: me, user: meUser } = await requireMember(match.tournamentId);

  if (match.status === "FINISHED") throw new Error("Utakmica je gotova — kasno je.");
  if (match.tournament.status !== "ACTIVE") throw new Error("Turnir nije aktivan.");

  const opponentMemberId = String(formData.get("opponentMemberId"));
  const stakeReps = Math.floor(Number(formData.get("stakeReps")));
  const terms = String(formData.get("terms")) as BetTermsKey;
  const customText = String(formData.get("customText") ?? "").trim() || null;

  if (!TERMS.includes(terms)) throw new Error("Nepoznata oklada.");
  if (terms === "CUSTOM" && !customText) throw new Error("Opiši posebnu okladu.");
  if (
    (terms === "MAIN_WIN" || terms === "MAIN_NOT_WIN") &&
    match.homeTeamId !== match.tournament.mainCountryId &&
    match.awayTeamId !== match.tournament.mainCountryId
  ) {
    throw new Error("Glavna reprezentacija ne igra ovu utakmicu.");
  }
  if (!Number.isInteger(stakeReps) || stakeReps < 1 || stakeReps > MAX_STAKE) {
    throw new Error(`Ulog mora biti 1–${MAX_STAKE} sklekova.`);
  }
  if (opponentMemberId === me.id) throw new Error("Ne možeš se kladiti sam sa sobom.");

  const opponent = await db.member.findUnique({ where: { id: opponentMemberId } });
  if (!opponent || opponent.tournamentId !== match.tournamentId) {
    throw new Error("Protivnik nije u ovoj ligi.");
  }

  await db.bet.create({
    data: {
      matchId,
      proposerMemberId: me.id,
      opponentMemberId,
      stakeReps,
      terms,
      customText: terms === "CUSTOM" ? customText : null,
    },
  });

  await sendPush([
    {
      userId: opponent.userId,
      title: "🎲 Novi izazov",
      body: `${meUser.displayName} te izaziva za ${stakeReps} sklekova`,
      url: `/t/${match.tournamentId}/match/${matchId}`,
    },
  ]);

  revalidatePath(`/t/${match.tournamentId}/match/${matchId}`);
}

/** Proposer withdraws a bet the opponent hasn't answered yet. */
export async function cancelBet(betId: string) {
  const bet = await db.bet.findUniqueOrThrow({
    where: { id: betId },
    include: { match: true },
  });
  const { member: me } = await requireMember(bet.match.tournamentId);
  if (bet.proposerMemberId !== me.id) throw new Error("Nije tvoja oklada.");
  if (bet.status !== "PROPOSED") return;
  await db.bet.delete({ where: { id: betId } });
  revalidatePath(`/t/${bet.match.tournamentId}/match/${bet.matchId}`);
}

export async function respondToBet(betId: string, formData: FormData) {
  const accept = formData.get("response") === "accept";
  const bet = await db.bet.findUniqueOrThrow({
    where: { id: betId },
    include: { match: true, proposer: true },
  });
  const { member: me, user: meUser } = await requireMember(bet.match.tournamentId);

  if (bet.opponentMemberId !== me.id) throw new Error("Ova oklada nije za tebe.");
  if (bet.status !== "PROPOSED") return;
  if (bet.match.status === "FINISHED") return;

  await db.bet.update({
    where: { id: betId },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });

  await sendPush([
    {
      userId: bet.proposer.userId,
      title: accept ? "🎲 Oklada prihvaćena" : "🎲 Oklada odbijena",
      body: `${meUser.displayName} je ${accept ? "prihvatio izazov — ulog " + bet.stakeReps : "odbio tvoj izazov"}`,
      url: `/t/${bet.match.tournamentId}/match/${bet.matchId}`,
    },
  ]);

  revalidatePath(`/t/${bet.match.tournamentId}/match/${bet.matchId}`);
}

/** Admin resolution for CUSTOM bets (or MAIN_* bets that couldn't auto-resolve). */
export async function resolveBetManually(betId: string, formData: FormData) {
  const bet = await db.bet.findUniqueOrThrow({
    where: { id: betId },
    include: {
      match: { include: { tournament: { include: { mainCountry: true } }, homeTeam: true, awayTeam: true } },
      proposer: { include: { user: true } },
      opponent: { include: { user: true } },
    },
  });
  await requireAdmin(bet.match.tournamentId);

  if (bet.status !== "ACCEPTED") return;
  const winnerMemberId = String(formData.get("winnerMemberId"));
  const winner =
    winnerMemberId === bet.proposerMemberId
      ? bet.proposer
      : winnerMemberId === bet.opponentMemberId
        ? bet.opponent
        : null;
  if (!winner) throw new Error("Pobjednik mora biti jedan od dvojice.");
  const loser = winner.id === bet.proposer.id ? bet.opponent : bet.proposer;

  await db.$transaction([
    db.bet.update({
      where: { id: betId },
      data: { status: "RESOLVED", winnerMemberId: winner.id },
    }),
    db.ledgerEntry.create({
      data: {
        memberId: loser.id,
        amount: bet.stakeReps,
        type: "BET",
        betId: bet.id,
        reason: `🎲 Oklada protiv ${winner.user.displayName}: "${betTermsLabel(
          bet.terms as BetTermsKey,
          {
            home: bet.match.homeTeam?.name ?? "Domaći",
            away: bet.match.awayTeam?.name ?? "Gosti",
            main: bet.match.tournament.mainCountry.name,
          },
          bet.customText,
        )}"`,
      },
    }),
  ]);

  const url = `/t/${bet.match.tournamentId}/match/${bet.matchId}`;
  await sendPush([
    {
      userId: loser.userId,
      title: "🎲 Izgubio si okladu",
      body: `+${bet.stakeReps} sklekova — protiv ${winner.user.displayName}`,
      url,
    },
    {
      userId: winner.userId,
      title: "🎲 Dobio si okladu",
      body: `${loser.user.displayName} ti duguje ${bet.stakeReps} sklekova više`,
      url,
    },
  ]);

  revalidatePath(`/t/${bet.match.tournamentId}/match/${bet.matchId}`);
}
