import Link from "next/link";
import { Camera, Settings, Video } from "lucide-react";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { getLeaderboard } from "@/lib/queries";
import { parsePentixConfig } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
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
  const isAdmin = member.role === "ADMIN";

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
    <AppShell
      section="league-overview"
      league={{
        id,
        name: tournament.name,
        mainCountry: tournament.mainCountry,
        isAdmin,
      }}
      headerRight={
        isAdmin ? (
          <Link
            href={`/t/${id}/settings`}
            className="btn btn-ghost px-2.5"
            aria-label="Postavke lige"
          >
            <Settings className="size-4" />
          </Link>
        ) : undefined
      }
    >
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-7">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
              {tournament.name}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">
              <TeamFlag
                flagUrl={tournament.mainCountry.flagUrl}
                name={tournament.mainCountry.name}
                size={14}
              />
              {tournament.mainCountry.name}
              {tournament.eliminatedAt && (
                <span className="badge badge-gray">ispala</span>
              )}
              {tournament.status === "FINISHED" && (
                <span className="badge badge-gray">završeno</span>
              )}
            </div>
          </div>
          {isAdmin && (
            <Link
              href={`/t/${id}/settings`}
              className="btn btn-outline hidden lg:inline-flex"
            >
              <Settings className="size-4" />
              Postavke
            </Link>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: stats, CTA, matches */}
          <div className="space-y-6 lg:col-span-3">
            <section className="grid grid-cols-3 gap-3">
              <div className="card p-4">
                <div className="text-xs font-medium text-muted">Tvoj dug</div>
                <div
                  className={`stat-number mt-1 ${
                    outstanding > 0 ? "text-danger" : "text-primary"
                  }`}
                >
                  {outstanding}
                </div>
                {outstanding > 0 && me?.oldestUnpaidAt && (
                  <div className="mt-1 text-xs text-muted">
                    od {formatDate(new Date(me.oldestUnpaidAt))}
                  </div>
                )}
              </div>
              <div className="card p-4">
                <div className="text-xs font-medium text-muted">Od toga kamata</div>
                <div className="stat-number mt-1 text-ink">
                  {me?.unpaidInterest ?? 0}
                </div>
                {outstanding > 0 && (
                  <div className="mt-1 text-xs font-medium text-danger">
                    raste +{dailyPct}%/dan
                  </div>
                )}
              </div>
              <div className="card p-4">
                <div className="text-xs font-medium text-muted">Plaćeno ukupno</div>
                <div className="stat-number mt-1 text-primary">
                  {me?.totalPaid ?? 0}
                </div>
              </div>
            </section>

            <div>
              <Link
                href={`/t/${id}/record`}
                className="btn btn-primary w-full py-3.5 text-base"
              >
                <Camera className="size-5" />
                Snimi sklekove
              </Link>
              <p className="mt-2 text-center text-xs text-muted">
                Kamera broji ponavljanja — svaki sklek skida 1 s duga.
              </p>
            </div>

            <section>
              <div className="flex items-center justify-between">
                <h2 className="section-title">Utakmice</h2>
                <span className="flex items-center gap-4 text-sm font-medium">
                  <Link
                    href={`/t/${id}/activity`}
                    className="inline-flex items-center gap-1.5 text-muted hover:text-ink lg:hidden"
                  >
                    <Video className="size-4" />
                    Dokazi
                  </Link>
                  <Link
                    href={`/t/${id}/matches`}
                    className="text-primary hover:underline"
                  >
                    Sve utakmice →
                  </Link>
                </span>
              </div>
              <div className="mt-3 space-y-2.5">
                {liveMatches.map((m) => (
                  <MatchCard key={m.id} match={{ ...m, phase: m.phase as never }} />
                ))}
                {upcomingMatches.map((m) => (
                  <MatchCard key={m.id} match={{ ...m, phase: m.phase as never }} />
                ))}
                {liveMatches.length === 0 && upcomingMatches.length === 0 && (
                  <div className="card p-5 text-center text-sm text-muted">
                    Nema nadolazećih praćenih utakmica.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right: leaderboard */}
          <div className="lg:col-span-2">
            <LiveLeaderboard
              tournamentId={id}
              initialRows={leaderboard}
              myMemberId={member.id}
            />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
