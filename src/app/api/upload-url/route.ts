import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { presignClipUpload, publicClipUrl, r2Configured } from "@/lib/r2";

const EXT_BY_TYPE: Record<string, string> = {
  "video/webm": "webm",
  "video/mp4": "mp4",
};

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!r2Configured()) {
    // Storage not set up — the client records the set without a clip.
    return NextResponse.json({ disabled: true });
  }

  const body = (await req.json().catch(() => null)) as {
    tournamentId?: string;
    contentType?: string;
  } | null;
  const tournamentId = body?.tournamentId;
  const baseType = (body?.contentType ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[baseType];
  if (!tournamentId || !ext) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId } });
  const member = user
    ? await db.member.findUnique({
        where: { userId_tournamentId: { userId: user.id, tournamentId } },
      })
    : null;
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const key = `clips/${tournamentId}/${member.id}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const uploadUrl = await presignClipUpload(key, baseType);

  return NextResponse.json({
    uploadUrl,
    key,
    publicUrl: publicClipUrl(key),
    contentType: baseType,
  });
}
