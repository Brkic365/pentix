import Link from "next/link";
import { PHASE_LABELS_HR, type PhaseKey } from "@/lib/config";
import { formatKickoff } from "@/lib/format";
import { TeamFlag } from "@/components/TeamFlag";

export interface MatchCardData {
  id: string;
  tournamentId: string;
  phase: PhaseKey;
  groupLetter: string | null;
  kickoff: Date;
  status: "UPCOMING" | "LIVE" | "FINISHED";
  homeScore: number;
  awayScore: number;
  isTracked: boolean;
  homeTeam: { name: string; fifaCode: string; flagUrl: string | null } | null;
  awayTeam: { name: string; fifaCode: string; flagUrl: string | null } | null;
  homeSlot: string | null;
  awaySlot: string | null;
}

function Side({
  team,
  slot,
}: {
  team: MatchCardData["homeTeam"];
  slot: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <TeamFlag flagUrl={team?.flagUrl} name={team?.name ?? "TBD"} size={20} />
      <span className="truncate text-sm font-semibold">
        {team?.name ?? slot ?? "TBD"}
      </span>
    </div>
  );
}

export function MatchCard({ match }: { match: MatchCardData }) {
  return (
    <Link
      href={`/t/${match.tournamentId}/match/${match.id}`}
      className={`block rounded-2xl border bg-surface p-4 transition-colors hover:border-volt/50 ${
        match.status === "LIVE" ? "border-volt/60" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
        <span>
          {PHASE_LABELS_HR[match.phase]}
          {match.groupLetter ? ` ${match.groupLetter}` : ""}
        </span>
        <span className="flex items-center gap-2">
          {match.isTracked && <span className="text-volt">⚡ puni dug</span>}
          {match.status === "LIVE" ? (
            <span className="debt-blink font-bold text-debt">● UŽIVO</span>
          ) : match.status === "FINISHED" ? (
            <span>kraj</span>
          ) : (
            <span>{formatKickoff(match.kickoff)}</span>
          )}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Side team={match.homeTeam} slot={match.homeSlot} />
        <div className="font-display text-xl tabular-nums">
          {match.status === "UPCOMING"
            ? "vs"
            : `${match.homeScore}:${match.awayScore}`}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-semibold">
            {match.awayTeam?.name ?? match.awaySlot ?? "TBD"}
          </span>
          <TeamFlag
            flagUrl={match.awayTeam?.flagUrl}
            name={match.awayTeam?.name ?? "TBD"}
            size={20}
          />
        </div>
      </div>
    </Link>
  );
}
