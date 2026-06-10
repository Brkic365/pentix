"use client";

import { useEffect, useState } from "react";

interface Suggestion {
  available: boolean;
  homeScore?: number;
  awayScore?: number;
  finished?: boolean;
}

const POLL_MS = 60_000;

/**
 * Admin-only hint strip: polls the optional external score source and nudges
 * when it disagrees with what's been logged. Never writes — the admin's
 * thumb stays the source of truth.
 */
export function LiveScoreSuggestion({
  matchId,
  homeScore,
  awayScore,
}: {
  matchId: string;
  homeScore: number;
  awayScore: number;
}) {
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`/api/live-score/${matchId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Suggestion;
        if (active) setSug(data);
      } catch {
        // best-effort only
      }
    }
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [matchId]);

  if (
    dismissed ||
    !sug?.available ||
    (sug.homeScore === homeScore && sug.awayScore === awayScore)
  ) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5 text-sm">
      <span className="flex-1">
        📡 Vanjski izvor javlja{" "}
        <strong>
          {sug.homeScore}:{sug.awayScore}
        </strong>
        {sug.finished && " (kraj)"} — kod nas je {homeScore}:{awayScore}. Fali
        gol? Upiši ga ručno.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted"
        aria-label="Sakrij"
      >
        ✕
      </button>
    </div>
  );
}
