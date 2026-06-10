import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { getLeaderboard } from "@/lib/queries";
import { parsePentixConfig } from "@/lib/config";
import { sklekova, formatDate } from "@/lib/format";
import { LiveLeaderboard } from "@/components/LiveLeaderboard";
import { MatchCard } from "@/components/MatchCard";
import { TeamFlag } from "@/components/TeamFlag";

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member, tournament } = await requireMember(id);
  const cfg = parsePentixConfig(tournament.config);

  const [leaderboard, liveMatches, upcomingMatches] = await Promise.all([
    getLeaderboard(id),
    db.match.findMany({
      where: { tournamentId: id, status: "LIVE" },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { kickoff: "asc" },
    }),
    db.match.findMany({
      where: { tournamentId: id, status: "UPCOMING", isTracked: true },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { kickoff: "asc" },
      take: 3,
    }),
  ]);

  const me = leaderboard.find((r) => r.memberId === member.id);
  const outstanding = me?.outstanding ?? 0;
  const dailyPct = Math.round(cfg.interest.dailyRate * 1000) / 10;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 pb-24">
      <header className="flex items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="text-muted">
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl leading-tight">
              {tournament.name}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <TeamFlag
                flagUrl={tournament.mainCountry.flagUrl}
                name={tournament.mainCountry.name}
                size={12}
              />
              {tournament.mainCountry.name}
              {tournament.eliminatedAt && " 💀"}
              {tournament.status === "FINISHED" && " · završeno"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {member.role === "ADMIN" && (
            <Link
              href={`/t/${id}/settings`}
              aria-label="Postavke"
              className="rounded-full border border-line p-2 text-muted"
            >
              ⚙️
            </Link>
          )}
          <UserButton />
        </div>
      </header>

      {/* Debt hero */}
      <section
        className={`rounded-3xl border p-5 ${
          outstanding > 0 ? "border-debt/40 bg-debt/5" : "border-volt/40 bg-volt/5"
        }`}
      >
        <div className="text-xs uppercase tracking-[0.2em] text-muted">
          tvoj dug
        </div>
        <div
          className={`font-display text-6xl leading-none tabular-nums ${
            outstanding > 0 ? "text-debt" : "text-volt"
          }`}
        >
          {outstanding}
        </div>
        <div className="mt-1 text-sm text-muted">
          {outstanding > 0 ? (
            <>{sklekova(outstanding)} preostalo</>
          ) : (
            <>čist si — zasad. ⚡</>
          )}
        </div>

        {outstanding > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="debt-blink font-semibold text-debt">
              🔥 kamata raste +{dailyPct}%/dan
            </span>
            {me && me.unpaidInterest > 0 && (
              <span className="text-muted">
                od toga kamata: {me.unpaidInterest}
              </span>
            )}
            {me?.oldestUnpaidAt && (
              <span className="text-muted">
                najstariji dug: {formatDate(new Date(me.oldestUnpaidAt))}
              </span>
            )}
          </div>
        )}
      </section>

      {/* THE hero CTA */}
      <Link
        href={`/t/${id}/record`}
        className="record-pulse mt-4 flex items-center justify-center gap-3 rounded-3xl bg-volt py-6 text-pitch shadow-lg"
      >
        <span className="flex size-5 items-center justify-center">
          <span className="size-4 rounded-full bg-debt ring-2 ring-pitch" />
        </span>
        <span className="font-display text-3xl tracking-wide">SNIMI SKLEKOVE</span>
      </Link>
      <p className="mt-2 text-center text-[11px] uppercase tracking-[0.2em] text-muted">
        kamera broji · svaki sklek skida 1 s duga
      </p>

      {/* Matches */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">UTAKMICE</h2>
          <Link href={`/t/${id}/matches`} className="text-sm text-volt">
            sve →
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {liveMatches.map((m) => (
            <MatchCard
              key={m.id}
              match={{ ...m, phase: m.phase as never }}
            />
          ))}
          {upcomingMatches.map((m) => (
            <MatchCard
              key={m.id}
              match={{ ...m, phase: m.phase as never }}
            />
          ))}
          {liveMatches.length === 0 && upcomingMatches.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-muted">
              Nema nadolazećih praćenih utakmica.
            </div>
          )}
        </div>
      </section>

      {/* Leaderboard */}
      <div className="mt-8">
        <LiveLeaderboard
          tournamentId={id}
          initialRows={leaderboard}
          myMemberId={member.id}
        />
      </div>
    </main>
  );
}
