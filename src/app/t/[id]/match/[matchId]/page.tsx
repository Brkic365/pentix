import Link from "next/link";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { parsePentixConfig, PHASE_LABELS_HR, type PhaseKey } from "@/lib/config";
import { formatKickoff, sklekova } from "@/lib/format";
import { deleteLastGoal } from "@/actions/goals";
import { finishMatch, setMatchTeams, startMatch, toggleTracked } from "@/actions/matches";
import { respondToBet, resolveBetManually } from "@/actions/bets";
import { betTermsLabel, type BetTermsKey } from "@/lib/engine/bets";
import { GoalFastEntry } from "@/components/GoalFastEntry";
import { BetCreateForm, type BetTermOption } from "@/components/BetCreateForm";
import { TeamFlag } from "@/components/TeamFlag";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm focus:border-volt focus:outline-none";

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
        <Link className="text-volt" href={`/t/${id}`}>
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
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 pb-24">
      <header className="flex items-center gap-3 py-4">
        <Link href={`/t/${id}/matches`} className="text-muted">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted">
            {PHASE_LABELS_HR[match.phase as PhaseKey]}
            {match.groupLetter && ` · skupina ${match.groupLetter}`}
            {match.stadium && ` · ${match.stadium.city}`}
          </div>
          <div className="text-sm text-muted">{formatKickoff(match.kickoff)}</div>
        </div>
        {match.isTracked ? (
          <span className="rounded-full bg-volt/15 px-3 py-1 text-xs font-bold text-volt">
            ⚡ puni dug
          </span>
        ) : (
          <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
            ne prati se
          </span>
        )}
      </header>

      {/* Scoreboard */}
      <section className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
            <TeamFlag flagUrl={match.homeTeam?.flagUrl} name={names.home} size={34} />
            <span className="text-sm font-semibold leading-tight">{names.home}</span>
          </div>
          <div className="text-center">
            {match.status === "UPCOMING" ? (
              <span className="font-display text-3xl text-muted">VS</span>
            ) : (
              <span className="font-display text-5xl tabular-nums">
                {match.homeScore}:{match.awayScore}
              </span>
            )}
            {match.status === "LIVE" && (
              <div className="debt-blink mt-1 text-xs font-bold text-debt">● UŽIVO</div>
            )}
            {match.wentToShootout && (
              <div className="mt-1 text-xs text-muted">
                pen {match.homePens}:{match.awayPens}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
            <TeamFlag flagUrl={match.awayTeam?.flagUrl} name={names.away} size={34} />
            <span className="text-sm font-semibold leading-tight">{names.away}</span>
          </div>
        </div>
      </section>

      {/* Admin: assign knockout teams */}
      {isAdmin && !teamsSet && match.status !== "FINISHED" && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg">POSTAVI EKIPE</h2>
          <form action={setTeamsBound} className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select name="homeTeamId" defaultValue={match.homeTeamId ?? ""} className={inputCls}>
                <option value="">Domaći — TBD</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select name="awayTeamId" defaultValue={match.awayTeamId ?? ""} className={inputCls}>
                <option value="">Gosti — TBD</option>
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
              aria-label="Početak (opcionalno)"
              className={`${inputCls} w-full`}
            />
            <button className="w-full rounded-xl bg-ink py-2.5 text-sm font-bold text-pitch">
              Spremi ekipe
            </button>
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
                  <button className="w-full rounded-xl border border-volt/60 bg-volt/10 py-3 font-semibold text-volt">
                    ▶ Počni utakmicu
                  </button>
                </form>
              )}
              {match.goals.length === 0 && (
                <form action={toggleTrackedBound} className="flex-1">
                  <button className="w-full rounded-xl border border-line py-3 text-sm text-muted">
                    {match.isTracked ? "Isključi praćenje" : "⚡ Prati utakmicu"}
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
            <details className="rounded-2xl border border-line bg-surface p-4">
              <summary className="cursor-pointer font-semibold text-muted">
                Završi utakmicu…
              </summary>
              <form action={finishMatchBound} className="mt-3 space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <label className="text-sm text-muted">{match.homeTeam?.fifaCode}</label>
                  <input
                    name="homeScore"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    defaultValue={match.homeScore}
                    className={`${inputCls} w-20 text-center font-display text-xl`}
                  />
                  <span className="text-muted">:</span>
                  <input
                    name="awayScore"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    defaultValue={match.awayScore}
                    className={`${inputCls} w-20 text-center font-display text-xl`}
                  />
                  <label className="text-sm text-muted">{match.awayTeam?.fifaCode}</label>
                </div>

                {match.phase !== "GROUP" && cfg.shootout.enabled && (
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="wentToShootout" className="size-4 accent-volt" />
                      Otišlo na jedanaesterce (svi +{cfg.shootout.everyoneReps}!)
                    </label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <input name="homePens" type="number" min={0} placeholder="pen dom." className={inputCls} />
                      <input name="awayPens" type="number" min={0} placeholder="pen gost." className={inputCls} />
                      <input
                        name="shootoutMisses"
                        type="number"
                        min={0}
                        placeholder={`promašaji (+${cfg.shootout.perMissBonus})`}
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}

                <ConfirmSubmit
                  message="Završavaš utakmicu — oklade se razrješavaju, rezultat se zaključava. Sigurno?"
                  className="w-full rounded-xl bg-ink py-3 font-bold text-pitch"
                >
                  KRAJ UTAKMICE
                </ConfirmSubmit>
              </form>
            </details>
          )}
        </section>
      )}

      {/* Goal feed */}
      <section className="mt-6">
        <h2 className="font-display text-xl">GOLOVI</h2>
        {match.goals.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {match.isTracked
              ? "Još ništa. Neka tako i ostane."
              : "Utakmica se ne prati — golovi ovdje ne pune dug."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...match.goals].reverse().map((g, idx) => {
              const teamName =
                g.scoringTeamId === match.homeTeamId ? names.home : names.away;
              const my = myAmountByGoal.get(g.id);
              const isLast = idx === 0;
              return (
                <li
                  key={g.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
                >
                  <span className="font-display text-lg text-muted">{g.minute}&apos;</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {g.scorerName}
                      {g.isOwnGoal && " (ag)"}
                      {g.isPenalty && " (11m)"}
                      {g.nthGoalBySamePlayer === 3 && " 🎩"}
                    </div>
                    <div className="text-[11px] text-muted">
                      {teamName}
                      {g.isLate && " · kasni gol"}
                    </div>
                  </div>
                  {my !== undefined && (
                    <span className="font-display text-debt">+{my}</span>
                  )}
                  {isAdmin && isLast && match.status !== "FINISHED" && (
                    <form action={deleteLastGoalBound}>
                      <ConfirmSubmit
                        message="Brišeš zadnji gol i sav dug koji je napravio. Sigurno?"
                        className="rounded-lg border border-line px-2 py-1 text-xs text-muted"
                      >
                        ✕
                      </ConfirmSubmit>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Bets */}
      <section className="mt-6">
        <h2 className="font-display text-xl">OKLADE</h2>

        {match.bets.length > 0 && (
          <ul className="mt-3 space-y-2">
            {match.bets.map((b) => {
              const label = betTermsLabel(b.terms as BetTermsKey, names, b.customText);
              const mine = b.opponentMemberId === member.id;
              return (
                <li key={b.id} className="rounded-2xl border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">
                        <span className="font-semibold">{b.proposer.user.displayName}</span>
                        <span className="text-muted"> tvrdi: </span>
                        <span className="font-semibold">&bdquo;{label}&rdquo;</span>
                      </div>
                      <div className="text-[11px] text-muted">
                        vs {b.opponent.user.displayName} · ulog {sklekova(b.stakeReps)}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        b.status === "PROPOSED"
                          ? "bg-gold/15 text-gold"
                          : b.status === "ACCEPTED"
                            ? "bg-volt/15 text-volt"
                            : b.status === "RESOLVED"
                              ? "bg-surface-2 text-ink"
                              : "bg-surface-2 text-muted"
                      }`}
                    >
                      {b.status === "PROPOSED" && "čeka"}
                      {b.status === "ACCEPTED" && "aktivna"}
                      {b.status === "DECLINED" && "odbijena"}
                      {b.status === "RESOLVED" &&
                        `✓ ${b.winner?.user.displayName ?? ""}`}
                    </span>
                  </div>

                  {mine && b.status === "PROPOSED" && match.status !== "FINISHED" && (
                    <div className="mt-2 flex gap-2">
                      <form action={respondToBet.bind(null, b.id)} className="flex-1">
                        <input type="hidden" name="response" value="accept" />
                        <button className="w-full rounded-lg bg-volt py-2 text-sm font-bold text-pitch">
                          Prihvati
                        </button>
                      </form>
                      <form action={respondToBet.bind(null, b.id)} className="flex-1">
                        <input type="hidden" name="response" value="decline" />
                        <button className="w-full rounded-lg border border-line py-2 text-sm text-muted">
                          Odbij
                        </button>
                      </form>
                    </div>
                  )}

                  {isAdmin && b.status === "ACCEPTED" && (
                    <form
                      action={resolveBetManually.bind(null, b.id)}
                      className="mt-2 flex gap-2"
                    >
                      <select name="winnerMemberId" className={`${inputCls} flex-1`}>
                        <option value={b.proposerMemberId}>
                          Pobijedio: {b.proposer.user.displayName}
                        </option>
                        <option value={b.opponentMemberId}>
                          Pobijedio: {b.opponent.user.displayName}
                        </option>
                      </select>
                      <button className="rounded-lg border border-line px-3 text-xs text-muted">
                        Razriješi
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {match.status !== "FINISHED" && tournament.status === "ACTIVE" && (
          <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
              Nova oklada
            </h3>
            <BetCreateForm
              matchId={matchId}
              opponents={members
                .filter((m) => m.id !== member.id)
                .map((m) => ({ id: m.id, name: m.user.displayName }))}
              termOptions={termOptions}
            />
          </div>
        )}
      </section>
    </main>
  );
}
