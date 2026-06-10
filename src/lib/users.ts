import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { devAuthEnabled, getClerkId } from "@/lib/auth";

/**
 * Returns the local User row for the signed-in Clerk user, creating/refreshing
 * it on first contact. Redirects to sign-in when unauthenticated.
 */
export async function requireUser() {
  const clerkId = await getClerkId();
  if (!clerkId) redirect("/sign-in");

  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  if (devAuthEnabled()) {
    return db.user.upsert({
      where: { clerkId },
      update: {},
      create: { clerkId, displayName: "Antonio (dev)" },
    });
  }

  const cu = await currentUser();
  const displayName =
    [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") ||
    cu?.username ||
    cu?.primaryEmailAddress?.emailAddress.split("@")[0] ||
    "Igrač";

  return db.user.upsert({
    where: { clerkId },
    update: { displayName, avatarUrl: cu?.imageUrl ?? null },
    create: { clerkId, displayName, avatarUrl: cu?.imageUrl ?? null },
  });
}

/** Membership guard: the signed-in user must be a member of the tournament. */
export async function requireMember(tournamentId: string) {
  const user = await requireUser();
  const member = await db.member.findUnique({
    where: { userId_tournamentId: { userId: user.id, tournamentId } },
    include: { tournament: { include: { mainCountry: true } } },
  });
  if (!member) redirect("/dashboard");
  return { user, member, tournament: member.tournament };
}

/** Admin guard. */
export async function requireAdmin(tournamentId: string) {
  const ctx = await requireMember(tournamentId);
  if (ctx.member.role !== "ADMIN") redirect(`/t/${tournamentId}`);
  return ctx;
}
