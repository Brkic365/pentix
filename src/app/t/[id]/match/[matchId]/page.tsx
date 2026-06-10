import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { parsePentixConfig, PHASE_LABELS_HR, type PhaseKey } from "@/lib/config";
import { formatKickoff } from "@/lib/format";
import { deleteLastGoal } from "@/actions/goals";
import { finishMatch, setMatchTeams, startMatch, toggleTracked } from "@/actions/matches";
import { respondToBet, resolveBetManually } from "@/actions/bets";
import { betTermsLabel, type BetTermsKey } from "@/lib/engine/bets";
import { AppHeader } from "@/components/AppHeader";
import { GoalFastEntry } from "@/components/GoalFastEntry";
import { LiveScoreSuggestion } from "@/components/LiveScoreSuggestion";
import { BetCreateForm, type BetTermOption } from "@/components/BetCreateForm";
import { TeamFlag } from "@/components/TeamFlag";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = await params;
  const { member, tournament } = await requireMember(id);
  const isAdmin = member.role === "ADMIN";

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      stadium: true,
      goals: { orderBy: [{ createdAt: "asc" }] },
      bets: {
        include: {
          proposer: { include: { user: true } },
          opponent: { include: { user: true } },
          winner: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!match || match.tournamentId !== id) {
    return (
      <main className="p-6 text-muted">
        Utakmica ne postoji.{" "}
        <Link className="text-primary underline" href={`/t/${id}`}>
          Natrag
        </Link>
      </main>
    );
  }

  const cfg = parsePentixConfig(tournament.config);
  const [members, myGoalEntries, teams] = await Promise.all([
    db.member.findMany({
      where: { tournamentId: id },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    }),
    db.ledgerEntry.findMany({
      where: { memberId: member.id, goalId: { in: match.goals.map((g) => g.id) } },
      select: { goalId: true, amount: true },
    }),
    isAdmin && (!match.homeTeamId || !match.awayTeamId)
      ? db.team.findMany({ orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  const myAmountByGoal = new Map(myGoalEntries.map((e) => [e.goalId, e.amount]));

  const teamsSet = match.homeTeamId !== null && match.awayTeamId !== null;
  const names = {
    home: match.homeTeam?.name ?? match.homeSlot ?? "TBD",
    away: match.awayTeam?.name ?? match.awaySlot ?? "TBD",
    main: tournament.mainCountry.name,
  };
  const mainPlays =
    match.homeTeamId === tournament.mainCountryId ||
    match.awayTeamId === tournament.mainCountryId;

  const termOptions: BetTermOption[] = [
    ...(mainPlays
      ? [
          { value: "MAIN_WIN", label: betTermsLabel("MAIN_WIN", names) },
          { value: "MAIN_NOT_WIN", label: betTermsLabel("MAIN_NOT_WIN", names) },
        ]
      : []),
    { value: "HOME_WIN", label: betTermsLabel("HOME_WIN", names) },
    { value: "AWAY_WIN", label: betTermsLabel("AWAY_WIN", names) },
    { value: "DRAW", label: betTermsLabel("DRAW", names) },
    { value: "OVER_2_5", label: betTermsLabel("OVER_2_5", names) },
    { value: "UNDER_2_5", label: betTermsLabel("UNDER_2_5", names) },
    { value: "CUSTOM", label: "Posebna oklada…" },
  ];

  const startMatchBound = startMatch.bind(null, matchId);
  const finishMatchBound = finishMatch.bind(null, matchId);
  const setTeamsBound = setMatchTeams.bind(null, matchId);
  const toggleTrackedBound = toggleTracked.bind(null, matchId);
  const deleteLastGoalBound = deleteLastGoal.bind(null, matchId);

  const knownScorers = [...new Set(match.goals.map((g) => g.scorerName))].reverse();

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-6">
          <Link
            href={`/t/${id}/matches`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Utakmice
          </Link>
          {match.isTracked ? (
            <span className="badge badge-green">prati se — stvara dug</span>
          ) : (
            <span className="badge badge-gray">ne prati se</span>
          )}
        </div>

        {/* Scoreboard */}
        <section className="card p-6">
          <div className="text-center text-xs text-muted">
            {PHASE_LABELS_HR[match.phase as PhaseKey]}
            {match.groupLetter && ` · skupina ${match.groupLetter}`}
            {match.stadium && ` · ${match.stadium.city}`}
            {" · "}
            {formatKickoff(match.kickoff)}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <TeamFlag flagUrl={match.homeTeam?.flagUrl} name={names.home} size={32} />
              <span className="text-sm font-medium leading-tight text-ink">
                {names.home}
              </span>
            </div>
            <div className="text-center">
              {match.status === "UPCOMING" ? (
                <span className="text-2xl font-medium text-muted">–</span>
              ) : (
                <span className="text-5xl font-semibold tabular-nums tracking-tight text-ink">
                  {match.homeScore}:{match.awayScore}
                </span>
              )}
              {match.status === "LIVE" && (
                <div className="mt-2">
                  <span className="badge badge-red">
                    <span className="live-dot size-1.5 rounded-full bg-[var(--danger)]" />
                    uživo
                  </span>
                </div>
              )}
              {match.wentToShootout && (
                <div className="mt-1.5 text-xs text-muted">
                  jedanaesterci {match.homePens}:{match.awayPens}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <TeamFlag flagUrl={match.awayTeam?.flagUrl} name={names.away} size={32} />
              <span className="text-sm font-medium leading-tight text-ink">
                {names.away}
              </span>
            </div>
          </div>
        </section>

        {isAdmin &&
          match.isTracked &&
          match.status !== "FINISHED" &&
          match.templateMatchId !== null &&
          process.env.WC_API_BASE && (
            <LiveScoreSuggestion
              matchId={matchId}
              homeScore={match.homeScore}
              awayScore={match.awayScore}
            />
          )}

        {/* Admin: assign knockout teams */}
        {isAdmin && !teamsSet && match.status !== "FINISHED" && (
          <section className="card mt-4 p-5">
            <h2 className="font-semibold text-ink">Postavi ekipe</h2>
            <p className="mt-1 text-sm text-muted">
              Ova utakmica čeka rasplet ždrijeba — dodijeli ekipe kad budu
              poznate.
            </p>
            <form action={setTeamsBound} className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select name="homeTeamId" defaultValue={match.homeTeamId ?? ""} className="input">
                  <option value="">Domaćin — TBD</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select name="awayTeamId" defaultValue={match.awayTeamId ?? ""} className="input">
                  <option value="">Gost — TBD</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="datetime-local"
                name="kickoff"
                aria-label="Početak (neobavezno)"
                className="input"
              />
              <button className="btn btn-outline w-full">Spremi ekipe</button>
            </form>
          </section>
        )}

        {/* Admin: lifecycle controls */}
        {isAdmin && match.status !== "FINISHED" && (
          <section className="mt-4 space-y-3">
            {match.status === "UPCOMING" && (
              <div className="flex gap-2">
                {teamsSet && (
                  <form action={startMatchBound} className="flex-1">
                    <button className="btn btn-outline w-full">
                      Označi početak utakmice
                    </button>
                  </form>
                )}
                {match.goals.length === 0 && (
                  <form action={toggleTrackedBound} className="flex-1">
                    <button className="btn btn-ghost w-full border border-line">
                      {match.isTracked ? "Isključi praćenje" : "Uključi praćenje"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {match.isTracked && teamsSet && tournament.status === "ACTIVE" && (
              <GoalFastEntry
                matchId={matchId}
                homeTeam={{
                  id: match.homeTeamId!,
                  name: names.home,
                  flagUrl: match.homeTeam?.flagUrl ?? null,
                }}
                awayTeam={{
                  id: match.awayTeamId!,
                  name: names.away,
                  flagUrl: match.awayTeam?.flagUrl ?? null,
                }}
                kickoffIso={match.kickoff.toISOString()}
                mainCountryId={tournament.mainCountryId}
                favoritePlayer={cfg.flatBonuses.favoritePlayerName}
                knownScorers={knownScorers}
              />
            )}

            {teamsSet && (
              <details className="card p-5">
                <summary className="cursor-pointer text-sm font-medium text-muted">
                  Završi utakmicu
                </summary>
                <form action={finishMatchBound} className="mt-4 space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <label className="text-sm font-medium text-muted">
                      {match.homeTeam?.fifaCode}
                    </label>
                    <input
                      name="homeScore"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      defaultValue={match.homeScore}
                      className="input w-20 text-center text-lg font-semibold"
                    />
                    <span className="text-muted">:</span>
                    <input
                      name="awayScore"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      defaultValue={match.awayScore}
                      className="input w-20 text-center text-lg font-semibold"
                    />
                    <label className="text-sm font-medium text-muted">
                      {match.awayTeam?.fifaCode}
                    </label>
                  </div>

                  {match.phase !== "GROUP" && cfg.shootout.enabled && (
                    <div className="rounded-lg border border-line bg-card-subtle p-3">
                      <label className="flex items-center gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          name="wentToShootout"
                          className="size-4 accent-[var(--primary)]"
                        />
                        Otišlo na jedanaesterce (svi dobivaju +
                        {cfg.shootout.everyoneReps})
                      </label>
                      <div className="mt-2.5 grid grid-cols-3 gap-2">
                        <input name="homePens" type="number" min={0} placeholder="pen. domaćin" className="input" />
                        <input name="awayPens" type="number" min={0} placeholder="pen. gost" className="input" />
                        <input
                          name="shootoutMisses"
                          type="number"
                          min={0}
                          placeholder={`promašaji (+${cfg.shootout.perMissBonus})`}
                          className="input"
                        />
                      </div>
                    </div>
                  )}

                  <ConfirmSubmit
                    message="Završavaš utakmicu — rezultat se zaključava i oklade se razrješavaju. Nastaviti?"
                    className="btn btn-primary w-full"
                  >
                    Potvrdi kraj utakmice
                  </ConfirmSubmit>
                </form>
              </details>
            )}
          </section>
        )}

        {/* Goal feed */}
        <section className="mt-8">
          <h2 className="section-title">Golovi</h2>
          {match.goals.length === 0 ? (
            <p className="card mt-3 p-5 text-center text-sm text-muted">
              {match.isTracked
                ? "Još nema golova."
                : "Utakmica se ne prati — golovi ovdje ne stvaraju dug."}
            </p>
          ) : (
            <div className="card mt-3 divide-y divide-[var(--border)]">
              {[...match.goals].reverse().map((g, idx) => {
                const teamName =
                  g.scoringTeamId === match.homeTeamId ? names.home : names.away;
                const my = myAmountByGoal.get(g.id);
                const isLast = idx === 0;
                const tags = [
                  g.isOwnGoal && "autogol",
                  g.isPenalty && "jedanaesterac",
                  g.isLate && "kasni gol",
                  g.nthGoalBySamePlayer === 3 && "hat-trick",
                ].filter(Boolean);
                return (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-9 text-sm font-semibold tabular-nums text-muted">
                      {g.minute}′
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {g.scorerName}
                      </div>
                      <div className="text-xs text-muted">
                        {teamName}
                        {tags.length > 0 && ` · ${tags.join(" · ")}`}
                      </div>
                    </div>
                    {my !== undefined && (
                      <span className="text-sm font-semibold tabular-nums text-danger">
                        +{my}
                      </span>
                    )}
                    {isAdmin && isLast && match.status !== "FINISHED" && (
                      <form action={deleteLastGoalBound}>
                        <ConfirmSubmit
                          message="Brišeš zadnji gol i sav dug koji je stvorio. Nastaviti?"
                          className="btn btn-ghost px-2 py-1.5"
                        >
                          <Trash2 className="size-4" />
                        </ConfirmSubmit>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Bets */}
        <section className="mt-8">
          <h2 className="section-title">Oklade</h2>

          {match.bets.length > 0 && (
            <div className="card mt-3 divide-y divide-[var(--border)]">
              {match.bets.map((b) => {
                const label = betTermsLabel(b.terms as BetTermsKey, names, b.customText);
                const mine = b.opponentMemberId === member.id;
                return (
                  <div key={b.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">
                          <span className="font-medium">{b.proposer.user.displayName}</span>
                          <span className="text-muted"> tvrdi: </span>
                          <span className="font-medium">&bdquo;{label}&rdquo;</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          protiv {b.opponent.user.displayName} · ulog {b.stakeReps}{" "}
                          sklekova
                        </div>
                      </div>
                      {b.status === "PROPOSED" && (
                        <span className="badge badge-amber">čeka odgovor</span>
                      )}
                      {b.status === "ACCEPTED" && (
                        <span className="badge badge-green">aktivna</span>
                      )}
                      {b.status === "DECLINED" && (
                        <span className="badge badge-gray">odbijena</span>
                      )}
                      {b.status === "RESOLVED" && (
                        <span className="badge badge-gray">
                          dobio {b.winner?.user.displayName ?? "—"}
                        </span>
                      )}
                    </div>

                    {mine && b.status === "PROPOSED" && match.status !== "FINISHED" && (
                      <div className="mt-2.5 flex gap-2">
                        <form action={respondToBet.bind(null, b.id)} className="flex-1">
                          <input type="hidden" name="response" value="accept" />
                          <button className="btn btn-primary w-full py-2">
                            Prihvati
                          </button>
                        </form>
                        <form action={respondToBet.bind(null, b.id)} className="flex-1">
                          <input type="hidden" name="response" value="decline" />
                          <button className="btn btn-outline w-full py-2">Odbij</button>
                        </form>
                      </div>
                    )}

                    {isAdmin && b.status === "ACCEPTED" && (
                      <form
                        action={resolveBetManually.bind(null, b.id)}
                        className="mt-2.5 flex gap-2"
                      >
                        <select name="winnerMemberId" className="input flex-1">
                          <option value={b.proposerMemberId}>
                            Dobio: {b.proposer.user.displayName}
                          </option>
                          <option value={b.opponentMemberId}>
                            Dobio: {b.opponent.user.displayName}
                          </option>
                        </select>
                        <button className="btn btn-outline">Razriješi</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {match.status !== "FINISHED" && tournament.status === "ACTIVE" && (
            <div className="card mt-3 p-5">
              <h3 className="text-sm font-semibold text-ink">Nova oklada</h3>
              <div className="mt-3">
                <BetCreateForm
                  matchId={matchId}
                  opponents={members
                    .filter((m) => m.id !== member.id)
                    .map((m) => ({ id: m.id, name: m.user.displayName }))}
                  termOptions={termOptions}
                />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
