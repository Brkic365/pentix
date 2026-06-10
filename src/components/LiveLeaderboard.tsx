"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeaderboardRow } from "@/lib/queries";
import { sklekova } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const POLL_MS = 10_000;
const MEDALS = ["🥇", "🥈", "🥉"];

function Avatar({ row }: { row: LeaderboardRow }) {
  if (row.avatarUrl) {
    return (
      <img
        src={row.avatarUrl}
        alt=""
        className="size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-muted">
      {row.displayName.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function LiveLeaderboard({
  tournamentId,
  initialRows,
  myMemberId,
}: {
  tournamentId: string;
  initialRows: LeaderboardRow[];
  myMemberId: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [live, setLive] = useState(false);
  const fetching = useRef(false);

  const refetch = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const res = await fetch(`/api/t/${tournamentId}/leaderboard`, {
        cache: "no-store",
      });
      if (res.ok) setRows(await res.json());
    } catch {
      // transient network error — next poll will retry
    } finally {
      fetching.current = false;
    }
  }, [tournamentId]);

  useEffect(() => {
    // Realtime when configured…
    const supabase = getSupabaseBrowser();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      ?.channel(`ledger-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "LedgerEntry" },
        () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(refetch, 250);
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    // …polling fallback always armed (10s when offline, slow safety net when live)
    const interval = setInterval(refetch, POLL_MS);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(interval);
      channel?.unsubscribe();
    };
  }, [tournamentId, refetch]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">LJESTVICA DUŽNIKA</h2>
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          <span
            className={`size-2 rounded-full ${live ? "bg-volt" : "bg-muted/40"}`}
          />
          {live ? "uživo" : "osvježava se"}
        </span>
      </div>
      <ol className="mt-3 space-y-2">
        {rows.map((row, i) => {
          const isMe = row.memberId === myMemberId;
          return (
            <li
              key={row.memberId}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                isMe ? "border-volt/60 bg-volt/5" : "border-line bg-surface"
              }`}
            >
              <span className="w-7 text-center font-display text-lg text-muted">
                {MEDALS[i] ?? i + 1}
              </span>
              <Avatar row={row} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {row.displayName}
                  {isMe && <span className="text-volt"> (ti)</span>}
                </div>
                <div className="text-[11px] text-muted">
                  plaćeno {row.totalPaid}
                  {row.unpaidInterest > 0 && (
                    <span className="text-debt">
                      {" "}
                      · kamata {row.unpaidInterest}
                    </span>
                  )}
                  {row.handicapMultiplier !== 1 && (
                    <span> · ×{row.handicapMultiplier}</span>
                  )}
                </div>
              </div>
              <div
                className={`text-right font-display text-lg tabular-nums ${
                  row.outstanding > 0 ? "text-debt" : "text-volt"
                }`}
              >
                {row.outstanding > 0 ? (
                  <>
                    {row.outstanding}
                    <div className="text-[10px] font-sans uppercase tracking-wider text-muted">
                      preostalo
                    </div>
                  </>
                ) : (
                  "ČIST ✓"
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {rows.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-muted">
          najmanje duguje = vodi · {sklekova(rows.reduce((s, r) => s + r.outstanding, 0))}{" "}
          visi nad ekipom
        </p>
      )}
    </section>
  );
}
