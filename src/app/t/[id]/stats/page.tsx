import Link from "next/link";
import { ArrowLeft, Crown, Flame, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { parsePentixConfig } from "@/lib/config";
import { normalizeName, scorerMatchesFavorite } from "@/lib/engine/accrual";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

/** League trivia: who costs, who pays, who bleeds interest. */
export default async function StatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member: me, tournament } = await requireMember(id);
  const cfg = parsePentixConfig(tournament.config);

  const [goals, members, resolvedBets, biggestHit] = await Promise.all([
    db.goal.findMany({
      where: { match: { tournamentId: id } },
      include: { match: { select: { homeTeamId: true } } },
    }),
    db.member.findMany({
      where: { tournamentId: id },
      include: {
        user: true,
        ledgerEntries: { select: { amount: true, type: true } },
        pushupSets: { select: { reps: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.bet.findMany({
      where: { match: { tournamentId: id }, status: "RESOLVED" },
      select: { proposerMemberId: true, opponentMemberId: true, winnerMemberId: true },
    }),
    db.ledgerEntry.findFirst({
      where: { member: { tournamentId: id }, type: "ACCRUAL" },
      orderBy: { amount: "desc" },
    }),
  ]);

  // scorers, grouped by normalized name
  const mainId = tournament.mainCountryId;
  const scorerMap = new Map<string, { name: string; count: number; forMain: number }>();
  let favoriteGoals = 0;
  for (const g of goals) {
    if (g.isOwnGoal) continue;
    if (scorerMatchesFavorite(g.scorerName, cfg.flatBonuses.favoritePlayerName)) {
      favoriteGoals += 1;
    }
    const key = normalizeName(g.scorerName);
    const cur = scorerMap.get(key) ?? { name: g.scorerName, count: 0, forMain: 0 };
    cur.count += 1;
    if (g.scoringTeamId === mainId) cur.forMain += 1;
    scorerMap.set(key, cur);
  }
  const topScorers = [...scorerMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // league totals
  const sumBy = (type: string) =>
    members.reduce(
      (s, m) =>
        s +
        m.ledgerEntries
          .filter((e) => e.type === type)
          .reduce((x, e) => x + e.amount, 0),
      0,
    );
  const totalAccrued = sumBy("ACCRUAL") + sumBy("BET");
  const totalPaid = sumBy("PAYMENT");
  const totalInterest = sumBy("INTEREST");
  const totalSets = members.reduce((s, m) => s + m.pushupSets.length, 0);

  // per-member table
  const memberRows = members
    .map((m) => {
      const paid = m.ledgerEntries
        .filter((e) => e.type === "PAYMENT")
        .reduce((s, e) => s + e.amount, 0);
      const interest = m.ledgerEntries
        .filter((e) => e.type === "INTEREST")
        .reduce((s, e) => s + e.amount, 0);
      const betsWon = resolvedBets.filter((b) => b.winnerMemberId === m.id).length;
      const betsLost = resolvedBets.filter(
        (b) =>
          b.winnerMemberId !== m.id &&
          (b.proposerMemberId === m.id || b.opponentMemberId === m.id),
      ).length;
      const bestSet = m.pushupSets.reduce((mx, s) => Math.max(mx, s.reps), 0);
      return {
        id: m.id,
        name: m.user.displayName,
        paid,
        interest,
        sets: m.pushupSets.length,
        bestSet,
        betsWon,
        betsLost,
      };
    })
    .sort((a, b) => b.paid - a.paid);

  const topPayer = memberRows[0];

  return (
    <AppShell
      section="league-stats"
      league={{
        id,
        name: tournament.name,
        mainCountry: tournament.mainCountry,
        isAdmin: me.role === "ADMIN",
      }}
    >
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="py-8">
          <Link
            href={`/t/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Natrag na ligu
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            Statistika
          </h1>
        </div>

        {/* league totals */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4">
            <div className="text-xs font-medium text-muted">Zarađeno duga</div>
            <div className="stat-number mt-1 text-danger">{totalAccrued}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium text-muted">Odrađeno sklekova</div>
            <div className="stat-number mt-1 text-primary">{totalPaid}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium text-muted">Kamata naplaćena</div>
            <div className="stat-number mt-1 text-ink">{totalInterest}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium text-muted">Snimljenih setova</div>
            <div className="stat-number mt-1 text-ink">{totalSets}</div>
          </div>
        </section>

        {/* records */}
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Flame className="size-3.5" />
              Najveći pojedinačni udar
            </div>
            {biggestHit ? (
              <>
                <div className="mt-1 text-xl font-semibold text-danger">
                  +{biggestHit.amount}
                </div>
                <div className="mt-1 truncate text-xs text-muted" title={biggestHit.reason}>
                  {biggestHit.reason}
                </div>
              </>
            ) : (
              <div className="mt-1 text-sm text-muted">još ništa</div>
            )}
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Crown className="size-3.5" />
              Najveći platiša
            </div>
            {topPayer && topPayer.paid > 0 ? (
              <>
                <div className="mt-1 text-xl font-semibold text-primary">
                  {topPayer.name}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {topPayer.paid} sklekova · najbolji set {topPayer.bestSet}
                </div>
              </>
            ) : (
              <div className="mt-1 text-sm text-muted">nitko još ne plaća</div>
            )}
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <Star className="size-3.5" />
              {cfg.flatBonuses.favoritePlayerName || "Omiljeni igrač"} brojač
            </div>
            <div className="mt-1 text-xl font-semibold text-ink">
              {favoriteGoals} {favoriteGoals === 1 ? "gol" : "gola"}
            </div>
            <div className="mt-1 text-xs text-muted">
              svaki nosi +{cfg.flatBonuses.favoritePlayerGoal}
            </div>
          </div>
        </section>

        {/* top scorers */}
        <section className="mt-8">
          <h2 className="section-title">Strijelci u praćenim utakmicama</h2>
          {topScorers.length === 0 ? (
            <p className="card mt-3 p-6 text-center text-sm text-muted">
              Još nema golova.
            </p>
          ) : (
            <div className="card mt-3 divide-y divide-[var(--border)]">
              {topScorers.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 text-center text-sm font-semibold text-muted">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {s.name}
                  </span>
                  <span className="text-xs text-muted">
                    {s.forMain > 0 && `${s.forMain} za nas · `}
                    {s.count - s.forMain > 0 && `${s.count - s.forMain} protiv nas`}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* per-member table */}
        <section className="mt-8">
          <h2 className="section-title">Po članu</h2>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Član</th>
                  <th className="px-3 py-2.5 text-right font-medium">Plaćeno</th>
                  <th className="px-3 py-2.5 text-right font-medium">Kamata</th>
                  <th className="px-3 py-2.5 text-right font-medium">Setovi</th>
                  <th className="px-3 py-2.5 text-right font-medium">Najbolji set</th>
                  <th className="px-4 py-2.5 text-right font-medium">Oklade D/I</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {memberRows.map((r) => (
                  <tr key={r.id} className={r.id === me.id ? "bg-primary-soft/50" : ""}>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {r.name}
                      {r.id === me.id && (
                        <span className="ml-1.5 text-xs text-primary">(ti)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-primary">
                      {r.paid}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-danger">
                      {r.interest}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.sets}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.bestSet}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.betsWon}/{r.betsLost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
