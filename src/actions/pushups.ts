"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { computeDebt } from "@/lib/engine/interest";

export interface SubmitPushupSetInput {
  reps: number;
  cvReps: number;
  cvConfidence: number;
  videoUrl: string | null;
}

/**
 * Confirmed set → PushupSet + PAYMENT ledger entry, 1:1. A rep is a rep:
 * handicap never touches payments.
 */
export async function submitPushupSet(
  tournamentId: string,
  input: SubmitPushupSetInput,
) {
  const { member } = await requireMember(tournamentId);

  const reps = Math.floor(Number(input.reps));
  const cvReps = Math.max(0, Math.floor(Number(input.cvReps)) || 0);
  const cvConfidence = Math.min(1, Math.max(0, Number(input.cvConfidence) || 0));
  if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
    throw new Error("Broj sklekova mora biti 1–1000.");
  }

  // Only accept clip URLs that point at our own bucket
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const videoUrl =
    input.videoUrl && base && input.videoUrl.startsWith(`${base}/`)
      ? input.videoUrl
      : null;

  const adjusted = reps !== cvReps;
  const reason =
    `💪 ${reps} sklekova` +
    (adjusted ? ` (kamera: ${cvReps})` : " (potvrdila kamera)");

  await db.$transaction(async (tx) => {
    const set = await tx.pushupSet.create({
      data: { memberId: member.id, reps, cvReps, cvConfidence, videoUrl },
    });
    await tx.ledgerEntry.create({
      data: {
        memberId: member.id,
        amount: reps,
        type: "PAYMENT",
        reason,
        pushupSetId: set.id,
      },
    });
  });

  const entries = await db.ledgerEntry.findMany({
    where: { memberId: member.id },
    select: { amount: true, type: true, createdAt: true },
  });
  const debt = computeDebt(entries);

  revalidatePath(`/t/${tournamentId}`);
  return { outstanding: debt.outstanding, paid: reps };
}
