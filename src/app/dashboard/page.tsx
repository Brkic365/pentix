import Link from "next/link";
import { CalendarDays, Plus, Shield, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/users";
import { computeDebt } from "@/lib/engine/interest";
import { joinByCode } from "@/actions/tournaments";
import { formatKickoff } from "@/lib/format";
import { AppShell } from "@/components/AppShell";
import { TeamFlag } from "@/components/TeamFlag";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

  const memberships = await db.member.findMany({
    where: { userId: user.id },
    include: {
      tournament: {
        include: { mainCountry: true, _count: { select: { members: true } } },
      },
      ledgerEntries: { select: { amount: true, type: true, createdAt: true } },
    },
    orderBy: { joinedAt: "desc" },
  });

  const rows = memberships.map((m) => ({
    membership: m,
    debt: computeDebt(m.ledgerEntries),
  }));
  const totalOutstanding = rows.reduce((s, r) => s + r.debt.outstanding, 0);
  const totalPaid = rows.reduce((s, r) => s + r.debt.totalPaid, 0);
  const activeCount = memberships.filter(
    (m) => m.tournament.status === "ACTIVE",
  ).length;

  const upcoming =
    memberships.length > 0
      ? await db.match.findMany({
          where: {
            tournamentId: { in: memberships.map((m) => m.tournamentId) },
            isTracked: true,
            status: { in: ["LIVE", "UPCOMING"] },
          },
          include: { homeTeam: true, awayTeam: true, tournament: true },
          orderBy: [{ status: "asc" }, { kickoff: "asc" }],
          take: 6,
        })
      : [];

  return (
    <AppShell section="dashboard">
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Moje lige
            </h1>
            <p className="mt-1 text-sm text-muted">
              Bok, {user.displayName} — pregled tvojih natjecanja.
            </p>
          </div>
          <Link href="/new" className="btn btn-primary">
            <Plus className="size-4" />
            Nova liga
          </Link>
        </div>

        {error === "kod" && (
          <p className="mb-4 rounded-lg border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger">
            Taj pozivni kod ne postoji. Provjeri i pokušaj ponovno.
          </p>
        )}

        {memberships.length > 0 && (
          <section className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <div className="text-xs font-medium text-muted">Ukupni dug</div>
              <div
                className={`stat-number mt-1 ${
                  totalOutstanding > 0 ? "text-danger" : "text-primary"
                }`}
              >
                {totalOutstanding}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-medium text-muted">Plaćeno ukupno</div>
              <div className="stat-number mt-1 text-primary">{totalPaid}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs font-medium text-muted">Aktivne lige</div>
              <div className="stat-number mt-1 text-ink">{activeCount}</div>
            </div>
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Leagues */}
          <section className="space-y-3 lg:col-span-2">
            {memberships.length === 0 && (
              <div className="card flex flex-col items-center gap-3 p-10 text-center">
                <Shield className="size-8 text-muted" />
                <p className="font-medium text-ink">Još nisi ni u jednoj ligi</p>
                <p className="max-w-sm text-sm text-muted">
                  Stvori svoju ligu ili se pridruži postojećoj pozivnim kodom.
                </p>
                <Link href="/new" className="btn btn-primary mt-2">
                  <Plus className="size-4" />
                  Stvori prvu ligu
                </Link>
              </div>
            )}
            {rows.map(({ membership: m, debt }) => (
              <Link
                key={m.id}
                href={`/t/${m.tournamentId}`}
                className="card flex items-center justify-between gap-4 p-4 transition-colors hover:border-line-strong"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TeamFlag
                    flagUrl={m.tournament.mainCountry.flagUrl}
                    name={m.tournament.mainCountry.name}
                    size={22}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">
                      {m.tournament.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      {m.tournament.mainCountry.name}
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {m.tournament._count.members}
                      </span>
                      {m.role === "ADMIN" && <span>· administrator</span>}
                      {m.tournament.status === "FINISHED" && <span>· završeno</span>}
                    </div>
                  </div>
                </div>
                {debt.outstanding > 0 ? (
                  <div className="text-right">
                    <div className="text-xl font-semibold tabular-nums text-danger">
                      {debt.outstanding}
                    </div>
                    <div className="text-xs text-muted">preostalo</div>
                  </div>
                ) : (
                  <span className="badge badge-green">Čisto</span>
                )}
              </Link>
            ))}
          </section>

          {/* Side column */}
          <div className="space-y-6">
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <CalendarDays className="size-4 text-muted" />
                Sljedeće utakmice
              </h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Nema nadolazećih praćenih utakmica.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-[var(--border)]">
                  {upcoming.map((m) => (
                    <Link
                      key={m.id}
                      href={`/t/${m.tournamentId}/match/${m.id}`}
                      className="block py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="truncate">{m.tournament.name}</span>
                        {m.status === "LIVE" ? (
                          <span className="badge badge-red">
                            <span className="live-dot size-1.5 rounded-full bg-[var(--danger)]" />
                            uživo
                          </span>
                        ) : (
                          <span className="shrink-0">{formatKickoff(m.kickoff)}</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium text-ink">
                        <TeamFlag
                          flagUrl={m.homeTeam?.flagUrl}
                          name={m.homeTeam?.name ?? "TBD"}
                          size={13}
                        />
                        <span className="truncate">
                          {m.homeTeam?.name ?? m.homeSlot ?? "TBD"}
                        </span>
                        <span className="text-muted">
                          {m.status === "LIVE"
                            ? `${m.homeScore}:${m.awayScore}`
                            : "–"}
                        </span>
                        <span className="truncate">
                          {m.awayTeam?.name ?? m.awaySlot ?? "TBD"}
                        </span>
                        <TeamFlag
                          flagUrl={m.awayTeam?.flagUrl}
                          name={m.awayTeam?.name ?? "TBD"}
                          size={13}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-5">
              <h2 className="text-sm font-semibold text-ink">Pridruži se ligi</h2>
              <p className="mt-1 text-xs text-muted">
                Upiši pozivni kod koji ti je poslao administrator.
              </p>
              <form action={joinByCode} className="mt-3 space-y-2">
                <input
                  name="code"
                  placeholder="npr. VATRENI1"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="input font-mono uppercase tracking-widest"
                />
                <button className="btn btn-outline w-full">Pridruži se</button>
              </form>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
