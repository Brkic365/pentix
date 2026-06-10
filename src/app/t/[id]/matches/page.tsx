import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { PHASES, PHASE_LABELS_HR, type PhaseKey } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function MatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sve?: string }>;
}) {
  const { id } = await params;
  const { sve } = await searchParams;
  const { member, tournament } = await requireMember(id);
  const showAll = sve === "1";

  const matches = await db.match.findMany({
    where: { tournamentId: id, ...(showAll ? {} : { isTracked: true }) },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoff: "asc" },
  });

  const byPhase = new Map<PhaseKey, typeof matches>();
  for (const m of matches) {
    const list = byPhase.get(m.phase as PhaseKey) ?? [];
    list.push(m);
    byPhase.set(m.phase as PhaseKey, list);
  }

  return (
    <AppShell
      section="league-matches"
      league={{
        id,
        name: tournament.name,
        mainCountry: tournament.mainCountry,
        isAdmin: member.role === "ADMIN",
      }}
    >
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="py-8">
          <Link
            href={`/t/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Natrag na ligu
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            Utakmice
          </h1>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/t/${id}/matches`}
            className={!showAll ? "btn btn-primary" : "btn btn-outline"}
          >
            Praćene
          </Link>
          <Link
            href={`/t/${id}/matches?sve=1`}
            className={showAll ? "btn btn-primary" : "btn btn-outline"}
          >
            Sve (104)
          </Link>
        </div>

        {matches.length === 0 && (
          <p className="card mt-6 p-6 text-center text-sm text-muted">
            Nema utakmica u ovom prikazu.
          </p>
        )}

        {PHASES.filter((p) => byPhase.has(p)).map((phase) => (
          <section key={phase} className="mt-8">
            <h2 className="section-title">{PHASE_LABELS_HR[phase]}</h2>
            <div className="mt-3 space-y-2.5">
              {byPhase.get(phase)!.map((m) => (
                <MatchCard key={m.id} match={{ ...m, phase: m.phase as never }} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </AppShell>
  );
}
