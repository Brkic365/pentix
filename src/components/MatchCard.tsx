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

export function MatchCard({ match }: { match: MatchCardData }) {
  return (
    <Link
      href={`/t/${match.tournamentId}/match/${match.id}`}
      className="card block p-4 transition-colors hover:border-line-strong"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          {PHASE_LABELS_HR[match.phase]}
          {match.groupLetter ? ` ${match.groupLetter}` : ""}
        </span>
        <span className="flex items-center gap-2">
          {match.isTracked && <span className="badge badge-green">prati se</span>}
          {match.status === "LIVE" ? (
            <span className="badge badge-red">
              <span className="live-dot size-1.5 rounded-full bg-[var(--danger)]" />
              uživo
            </span>
          ) : match.status === "FINISHED" ? (
            <span>završeno</span>
          ) : (
            <span>{formatKickoff(match.kickoff)}</span>
          )}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TeamFlag flagUrl={match.homeTeam?.flagUrl} name={match.homeTeam?.name ?? "TBD"} size={20} />
          <span className="truncate text-sm font-medium text-ink">
            {match.homeTeam?.name ?? match.homeSlot ?? "TBD"}
          </span>
        </div>
        <div className="text-lg font-semibold tabular-nums tracking-tight text-ink">
          {match.status === "UPCOMING" ? (
            <span className="text-sm font-normal text-muted">–</span>
          ) : (
            `${match.homeScore}:${match.awayScore}`
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
          <span className="truncate text-right text-sm font-medium text-ink">
            {match.awayTeam?.name ?? match.awaySlot ?? "TBD"}
          </span>
          <TeamFlag flagUrl={match.awayTeam?.flagUrl} name={match.awayTeam?.name ?? "TBD"} size={20} />
        </div>
      </div>
    </Link>
  );
}
