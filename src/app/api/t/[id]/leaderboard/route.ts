import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClerkId } from "@/lib/auth";
import { getLeaderboard } from "@/lib/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clerkId = await getClerkId();
  if (!clerkId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId } });
  const member = user
    ? await db.member.findUnique({
        where: { userId_tournamentId: { userId: user.id, tournamentId: id } },
      })
    : null;
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await getLeaderboard(id);
  return NextResponse.json(rows, {
    headers: { "Cache-Control": "no-store" },
  });
}
