"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { logGoal } from "@/actions/goals";
import { TeamFlag } from "@/components/TeamFlag";

interface TeamInfo {
  id: number;
  name: string;
  flagUrl: string | null;
}

const LATE_FROM_MINUTE = 85;

/**
 * Fast goal entry: tap team → tap scorer chip (or type) → submit.
 * Minute is prefilled from kickoff, the late flag auto-follows it.
 */
export function GoalFastEntry({
  matchId,
  homeTeam,
  awayTeam,
  kickoffIso,
  mainCountryId,
  favoritePlayer,
  knownScorers,
}: {
  matchId: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  kickoffIso: string;
  mainCountryId: number;
  favoritePlayer: string;
  knownScorers: string[];
}) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [scorer, setScorer] = useState("");
  const initialMinute = useMemo(() => {
    const elapsed = Math.floor((Date.now() - new Date(kickoffIso).getTime()) / 60_000);
    return Math.min(120, Math.max(1, elapsed));
  }, [kickoffIso]);
  const [minute, setMinute] = useState(initialMinute);
  const [lateTouched, setLateTouched] = useState(false);
  const [isLate, setIsLate] = useState(initialMinute >= LATE_FROM_MINUTE);
  const [isPenalty, setIsPenalty] = useState(false);
  const [isOwnGoal, setIsOwnGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chips = useMemo(() => {
    const set = new Set<string>();
    if (favoritePlayer) set.add(favoritePlayer);
    for (const s of knownScorers) {
      if (set.size >= 6) break;
      set.add(s);
    }
    return [...set];
  }, [favoritePlayer, knownScorers]);

  function updateMinute(m: number) {
    setMinute(m);
    if (!lateTouched) setIsLate(m >= LATE_FROM_MINUTE);
  }

  function reset() {
    setTeamId(null);
    setScorer("");
    setIsPenalty(false);
    setIsOwnGoal(false);
    setLateTouched(false);
    setError(null);
  }

  function submit() {
    if (teamId === null) {
      setError("Odaberi ekipu koja je zabila.");
      return;
    }
    const fd = new FormData();
    fd.set("scoringTeamId", String(teamId));
    fd.set("scorerName", scorer);
    fd.set("minute", String(minute));
    if (isPenalty) fd.set("isPenalty", "on");
    if (isOwnGoal) fd.set("isOwnGoal", "on");
    if (isLate) fd.set("isLate", "on");
    startTransition(async () => {
      try {
        await logGoal(matchId, fd);
        reset();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nešto je pošlo po zlu. Pokušaj ponovno.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          updateMinute(
            Math.min(120, Math.max(1, Math.floor((Date.now() - new Date(kickoffIso).getTime()) / 60_000))),
          );
          setOpen(true);
        }}
        className="btn btn-primary w-full py-3 text-base"
      >
        <Plus className="size-5" />
        Upiši gol
      </button>
    );
  }

  const chipCls = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-primary-soft-border bg-primary-soft text-primary"
        : "border-line-strong bg-card text-muted hover:text-ink"
    }`;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Novi gol</h3>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-sm text-muted hover:text-ink"
        >
          Odustani
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {[homeTeam, awayTeam].map((team) => (
          <button
            key={team.id}
            type="button"
            onClick={() => setTeamId(team.id)}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
              teamId === team.id
                ? "border-primary-soft-border bg-primary-soft text-primary"
                : "border-line-strong bg-card text-ink hover:bg-card-subtle"
            }`}
          >
            <TeamFlag flagUrl={team.flagUrl} name={team.name} size={16} />
            <span className="truncate">{team.name}</span>
            {team.id === mainCountryId && <span aria-hidden>★</span>}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <input
          value={scorer}
          onChange={(e) => setScorer(e.target.value)}
          placeholder="Strijelac (npr. Livaja)"
          className="input"
        />
        {chips.length > 0 && (
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setScorer(c)}
                className={chipCls(scorer === c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          minuta
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={130}
            value={minute}
            onChange={(e) => updateMinute(Number(e.target.value))}
            className="input w-20 text-center"
          />
        </label>
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          <button type="button" onClick={() => setIsPenalty(!isPenalty)} className={chipCls(isPenalty)}>
            jedanaesterac
          </button>
          <button type="button" onClick={() => setIsOwnGoal(!isOwnGoal)} className={chipCls(isOwnGoal)}>
            autogol
          </button>
          <button
            type="button"
            onClick={() => {
              setLateTouched(true);
              setIsLate(!isLate);
            }}
            className={chipCls(isLate)}
          >
            kasni (85′+)
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="btn btn-primary mt-4 w-full py-3"
      >
        {pending ? "Upisujem…" : "Upiši gol"}
      </button>
    </div>
  );
}
