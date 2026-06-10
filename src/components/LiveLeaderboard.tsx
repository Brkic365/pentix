"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeaderboardRow } from "@/lib/queries";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const POLL_MS = 10_000;

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
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card-subtle text-sm font-semibold text-muted">
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

    // …polling fallback always armed
    const interval = setInterval(refetch, POLL_MS);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(interval);
      channel?.unsubscribe();
    };
  }, [tournamentId, refetch]);

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="section-title">Ljestvica</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className={`size-2 rounded-full ${
              live ? "live-dot bg-[var(--primary)]" : "bg-[var(--border-strong)]"
            }`}
          />
          {live ? "uživo" : "osvježava se svakih 10 s"}
        </span>
      </div>
      <div className="card mt-3 divide-y divide-[var(--border)]">
        {rows.map((row, i) => {
          const isMe = row.memberId === myMemberId;
          return (
            <div
              key={row.memberId}
              className={`flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl ${
                isMe ? "bg-primary-soft/60" : ""
              }`}
            >
              <span
                className={`w-6 text-center text-sm font-semibold ${
                  i === 0 ? "text-primary" : "text-muted"
                }`}
              >
                {i + 1}
              </span>
              <Avatar row={row} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {row.displayName}
                  </span>
                  {isMe && <span className="badge badge-green">ti</span>}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  plaćeno {row.totalPaid}
                  {row.unpaidInterest > 0 && ` · kamata ${row.unpaidInterest}`}
                  {row.handicapMultiplier !== 1 && ` · ×${row.handicapMultiplier}`}
                </div>
              </div>
              <div className="text-right">
                {row.outstanding > 0 ? (
                  <>
                    <div className="text-lg font-semibold tabular-nums text-danger">
                      {row.outstanding}
                    </div>
                    <div className="text-[11px] text-muted">preostalo</div>
                  </>
                ) : (
                  <span className="badge badge-green">čisto</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {rows.length > 1 && (
        <p className="mt-2 text-center text-xs text-muted">
          Najmanje duguje — vodi. Ukupno nad ekipom: {totalOutstanding} sklekova.
        </p>
      )}
    </section>
  );
}
