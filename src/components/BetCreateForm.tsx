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
        Zasad nemaš protivnika — pozovi još članova pa se kladite.
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
            setError(e instanceof Error ? e.message : "Nešto je pošlo po zlu.");
          }
        })
      }
      id={`bet-form-${matchId}`}
      className="space-y-2.5"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Protivnik</label>
          <select name="opponentMemberId" className="input">
            {opponents.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ulog (sklekova)</label>
          <input
            name="stakeReps"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            defaultValue={10}
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="label">Tvrdnja</label>
        <select
          name="terms"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className="input"
        >
          {termOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {terms === "CUSTOM" && (
        <input
          name="customText"
          placeholder="Opiši okladu (npr. Gvardiol zabija glavom)"
          className="input"
        />
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={pending} className="btn btn-outline w-full">
        {pending ? "Šaljem…" : "Pošalji izazov"}
      </button>
      <p className="text-xs text-muted">
        Tvrdiš da će se to dogoditi; ako ne bude, ulog plaćaš ti. Oklade su
        fiksne — handicap se ne primjenjuje.
      </p>
    </form>
  );
}
