import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/users";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await requireUser();

  const tournament = await db.tournament.findUnique({
    where: { inviteCode: code.toUpperCase() },
  });
  if (!tournament) redirect("/dashboard?error=kod");

  await db.member.upsert({
    where: {
      userId_tournamentId: { userId: user.id, tournamentId: tournament.id },
    },
    update: {},
    create: { userId: user.id, tournamentId: tournament.id, role: "PLAYER" },
  });

  redirect(`/t/${tournament.id}`);
}
