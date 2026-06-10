"use client";

import { useState, useTransition } from "react";
import { proposeBet } from "@/actions/bets";

export interface BetTermOption {
  value: string;
  label: string;
}

export function BetCreateForm({
  matchId,
  opponents,
  termOptions,
}: {
  matchId: string;
  opponents: { id: string; name: string }[];
  termOptions: BetTermOption[];
}) {
  const [terms, setTerms] = useState(termOptions[0]?.value ?? "CUSTOM");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (opponents.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nemaš s kim — pozovi još ekipe pa se kladite.
      </p>
    );
  }

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          try {
            setError(null);
            await proposeBet(matchId, fd);
            (document.getElementById(`bet-form-${matchId}`) as HTMLFormElement)?.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Nešto je puklo.");
          }
        })
      }
      id={`bet-form-${matchId}`}
      className="space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <select
          name="opponentMemberId"
          className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm focus:border-volt focus:outline-none"
        >
          {opponents.map((o) => (
            <option key={o.id} value={o.id}>
              vs {o.name}
            </option>
          ))}
        </select>
        <input
          name="stakeReps"
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          defaultValue={10}
          aria-label="Ulog (sklekovi)"
          className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm focus:border-volt focus:outline-none"
        />
      </div>
      <select
        name="terms"
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm focus:border-volt focus:outline-none"
      >
        {termOptions.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {terms === "CUSTOM" && (
        <input
          name="customText"
          placeholder="Opiši okladu (npr. Gvardiol zabija glavom)"
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted/60 focus:border-volt focus:outline-none"
        />
      )}
      {error && <p className="text-sm text-debt">{error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-ink py-2.5 text-sm font-bold text-pitch disabled:opacity-60"
      >
        {pending ? "Šaljem…" : "IZAZOVI 🎲"}
      </button>
      <p className="text-[11px] text-muted">
        Tvrdiš da će se to dogoditi. Gubitnik radi ulog — bez handicapa, oklada
        je oklada.
      </p>
    </form>
  );
}
