import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Best-effort live-score suggestion, proxied from a free worldcup2026 API
 * instance (WC_API_BASE). Purely a prefill hint for the admin — goals are
 * always confirmed by hand; this endpoint never writes anything.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  const base = process.env.WC_API_BASE;
  if (!base) return NextResponse.json({ available: false, reason: "disabled" });

  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { templateMatchId: true, tournamentId: true },
  });
  if (!match?.templateMatchId) {
    return NextResponse.json({ available: false, reason: "no-template" });
  }
  const user = await db.user.findUnique({ where: { clerkId } });
  const member = user
    ? await db.member.findUnique({
        where: {
          userId_tournamentId: { userId: user.id, tournamentId: match.tournamentId },
        },
      })
    : null;
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const res = await fetch(base, {
      headers: process.env.WC_API_JWT
        ? { Authorization: `Bearer ${process.env.WC_API_JWT}` }
        : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const raw: unknown = await res.json();

    // Tolerant shape mapping: the dataset API ships {id, home_score, away_score,
    // finished}; accept common variants too.
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { data?: unknown[] })?.data)
        ? (raw as { data: unknown[] }).data
        : Array.isArray((raw as { games?: unknown[] })?.games)
          ? (raw as { games: unknown[] }).games
          : [];

    const game = list.find((g) => {
      const it = g as Record<string, unknown>;
      return Number(it.id ?? it.match_id ?? it.matchId) === match.templateMatchId;
    }) as Record<string, unknown> | undefined;

    if (!game) return NextResponse.json({ available: false, reason: "not-found" });

    const num = (...keys: string[]) => {
      for (const k of keys) {
        const v = game[k];
        if (v !== undefined && v !== null && v !== "") {
          const n = Number(v);
          if (Number.isFinite(n)) return n;
        }
      }
      return 0;
    };
    const finishedRaw = game.finished ?? game.is_finished;
    const finished =
      finishedRaw === true ||
      String(finishedRaw).toUpperCase() === "TRUE" ||
      game.time_elapsed === "finished";

    return NextResponse.json({
      available: true,
      homeScore: num("home_score", "homeScore"),
      awayScore: num("away_score", "awayScore"),
      finished,
    });
  } catch {
    return NextResponse.json({ available: false, reason: "unavailable" });
  }
}
