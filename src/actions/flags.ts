"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";

/** Crew anti-cheat: toggle your "sumnjiv set" flag on someone's recording. */
export async function toggleSetFlag(pushupSetId: string) {
  const set = await db.pushupSet.findUniqueOrThrow({
    where: { id: pushupSetId },
    include: { member: true },
  });
  const { member: me } = await requireMember(set.member.tournamentId);
  if (set.memberId === me.id) {
    throw new Error("Vlastiti set ne možeš prijaviti — to bi bilo previše iskreno.");
  }

  const existing = await db.setFlag.findUnique({
    where: { pushupSetId_memberId: { pushupSetId, memberId: me.id } },
  });
  if (existing) {
    await db.setFlag.delete({ where: { id: existing.id } });
  } else {
    await db.setFlag.create({ data: { pushupSetId, memberId: me.id } });
  }
  revalidatePath(`/t/${set.member.tournamentId}/activity`);
}
