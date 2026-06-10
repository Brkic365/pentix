import Link from "next/link";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
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
  await requireMember(id);
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
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 pb-16">
      <header className="flex items-center gap-3 py-4">
        <Link href={`/t/${id}`} className="text-muted">
          ←
        </Link>
        <h1 className="font-display text-2xl">UTAKMICE</h1>
      </header>

      <div className="flex gap-2">
        <Link
          href={`/t/${id}/matches`}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            !showAll ? "bg-volt text-pitch" : "border border-line text-muted"
          }`}
        >
          ⚡ Praćene
        </Link>
        <Link
          href={`/t/${id}/matches?sve=1`}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            showAll ? "bg-volt text-pitch" : "border border-line text-muted"
          }`}
        >
          Sve (104)
        </Link>
      </div>

      {matches.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          Nema utakmica u ovom prikazu.
        </p>
      )}

      {PHASES.filter((p) => byPhase.has(p)).map((phase) => (
        <section key={phase} className="mt-6">
          <h2 className="font-display text-lg text-muted">
            {PHASE_LABELS_HR[phase].toUpperCase()}
          </h2>
          <div className="mt-2 space-y-2">
            {byPhase.get(phase)!.map((m) => (
              <MatchCard key={m.id} match={{ ...m, phase: m.phase as never }} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
