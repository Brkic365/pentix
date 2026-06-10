"use client";

import { useMemo, useState, useTransition } from "react";
import { logGoal } from "@/actions/goals";
import { TeamFlag } from "@/components/TeamFlag";

interface TeamInfo {
  id: number;
  name: string;
  flagUrl: string | null;
}

const LATE_FROM_MINUTE = 85;

/**
 * The 5-second goal entry: tap team → tap scorer chip (or type) → GOL.
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
      setError("Tko je zabio? Odaberi ekipu.");
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
        setError(e instanceof Error ? e.message : "Nešto je puklo. Probaj opet.");
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
        className="w-full rounded-2xl bg-volt py-4 font-display text-2xl text-pitch"
      >
        + GOL ⚽
      </button>
    );
  }

  const teamBtn = (team: TeamInfo) => (
    <button
      key={team.id}
      type="button"
      onClick={() => setTeamId(team.id)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3.5 font-semibold transition-colors ${
        teamId === team.id
          ? "border-volt bg-volt/15 text-volt"
          : "border-line bg-surface-2 text-ink"
      }`}
    >
      <TeamFlag flagUrl={team.flagUrl} name={team.name} size={18} />
      <span className="truncate">
        {team.name}
        {team.id === mainCountryId && " ★"}
      </span>
    </button>
  );

  return (
    <div className="rounded-2xl border border-volt/50 bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">GOL!</h3>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-sm text-muted"
        >
          odustani
        </button>
      </div>

      <div className="mt-3 flex gap-2">{[homeTeam, awayTeam].map(teamBtn)}</div>

      <div className="mt-3">
        <input
          value={scorer}
          onChange={(e) => setScorer(e.target.value)}
          placeholder="Strijelac (npr. Livaja)"
          className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 placeholder:text-muted/60 focus:border-volt focus:outline-none"
        />
        {chips.length > 0 && (
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setScorer(c)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                  scorer === c
                    ? "border-volt bg-volt/15 text-volt"
                    : "border-line text-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          minuta
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={130}
            value={minute}
            onChange={(e) => updateMinute(Number(e.target.value))}
            className="w-20 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-center text-ink focus:border-volt focus:outline-none"
          />
        </label>
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {[
            { label: "penal", value: isPenalty, set: setIsPenalty },
            { label: "autogol", value: isOwnGoal, set: setIsOwnGoal },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => t.set(!t.value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                t.value ? "border-volt bg-volt/15 text-volt" : "border-line text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setLateTouched(true);
              setIsLate(!isLate);
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              isLate ? "border-volt bg-volt/15 text-volt" : "border-line text-muted"
            }`}
          >
            kasni (85&apos;+)
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-debt">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-3 w-full rounded-xl bg-volt py-3.5 font-display text-xl text-pitch disabled:opacity-60"
      >
        {pending ? "UPISUJEM…" : "UPIŠI GOL"}
      </button>
    </div>
  );
}
