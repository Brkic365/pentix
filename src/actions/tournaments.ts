"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, requireMember, requireUser } from "@/lib/users";
import { generateInviteCode } from "@/lib/invite";
import { DEFAULT_CONFIG, parsePentixConfig } from "@/lib/config";
import { hasConfigFields, parseConfigFormData } from "@/lib/configForm";
import { sendPush } from "@/lib/push";
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
  // The creation form ships the full formula editor; fall back to defaults
  // when a caller submits without it.
  const config = hasConfigFields(formData) ? parseConfigFormData(formData) : DEFAULT_CONFIG;

  const template = await db.templateMatch.findMany({ orderBy: { id: "asc" } });

  const tournament = await db.$transaction(async (tx) => {
    const t = await tx.tournament.create({
      data: {
        name,
        mainCountryId,
        config,
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
  const config = parseConfigFormData(formData);

  await db.tournament.update({
    where: { id: tournamentId },
    data: { config },
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

/**
 * Admin removes a member. Destructive: their ledger, sets and bets go with
 * them (DB cascade). The owner can never be removed.
 */
export async function removeMember(tournamentId: string, formData: FormData) {
  const { tournament } = await requireAdmin(tournamentId);
  const memberId = String(formData.get("memberId"));
  const target = await db.member.findUnique({ where: { id: memberId } });
  if (!target || target.tournamentId !== tournamentId) return;
  if (target.userId === tournament.ownerId) {
    throw new Error("Vlasnika lige nije moguće ukloniti.");
  }
  await db.member.delete({ where: { id: memberId } });
  revalidatePath(`/t/${tournamentId}/settings`);
  revalidatePath(`/t/${tournamentId}`);
}

/** Leave a league you're a member of. The owner stays until the bitter end. */
export async function leaveTournament(tournamentId: string) {
  const { user, member, tournament } = await requireMember(tournamentId);
  if (user.id === tournament.ownerId) {
    throw new Error("Vlasnik ne može napustiti vlastitu ligu.");
  }
  await db.member.delete({ where: { id: member.id } });
  redirect("/dashboard");
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

  await sendPush(
    members.map((m) => ({
      userId: m.userId,
      title: `💀 ${tournament.mainCountry.name} je ispala`,
      body: `+${eliminationAmount(cfg, m.handicapMultiplier)} sklekova za tebe · ${tournament.name}`,
      url: `/t/${tournamentId}`,
    })),
  );

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
