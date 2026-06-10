import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/users";
import { computeDebt } from "@/lib/engine/interest";
import { joinByCode } from "@/actions/tournaments";
import { AppHeader } from "@/components/AppHeader";
import { TeamFlag } from "@/components/TeamFlag";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

  const memberships = await db.member.findMany({
    where: { userId: user.id },
    include: {
      tournament: { include: { mainCountry: true } },
      ledgerEntries: { select: { amount: true, type: true, createdAt: true } },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Moje lige
            </h1>
            <p className="mt-1 text-sm text-muted">
              Bok, {user.displayName} — pregled tvojih natjecanja.
            </p>
          </div>
          <Link href="/new" className="btn btn-primary">
            <Plus className="size-4" />
            Nova liga
          </Link>
        </div>

        {error === "kod" && (
          <p className="mb-4 rounded-lg border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger">
            Taj pozivni kod ne postoji. Provjeri i pokušaj ponovno.
          </p>
        )}

        <section className="space-y-3">
          {memberships.length === 0 && (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <Shield className="size-8 text-muted" />
              <p className="font-medium text-ink">Još nisi ni u jednoj ligi</p>
              <p className="max-w-sm text-sm text-muted">
                Stvori svoju ligu ili se pridruži postojećoj pozivnim kodom.
              </p>
            </div>
          )}
          {memberships.map((m) => {
            const debt = computeDebt(m.ledgerEntries);
            return (
              <Link
                key={m.id}
                href={`/t/${m.tournamentId}`}
                className="card flex items-center justify-between gap-4 p-4 transition-colors hover:border-line-strong"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TeamFlag
                    flagUrl={m.tournament.mainCountry.flagUrl}
                    name={m.tournament.mainCountry.name}
                    size={22}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">
                      {m.tournament.name}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {m.tournament.mainCountry.name}
                      {m.role === "ADMIN" && " · administrator"}
                      {m.tournament.status === "FINISHED" && " · završeno"}
                    </div>
                  </div>
                </div>
                {debt.outstanding > 0 ? (
                  <div className="text-right">
                    <div className="text-xl font-semibold tabular-nums text-danger">
                      {debt.outstanding}
                    </div>
                    <div className="text-xs text-muted">preostalo</div>
                  </div>
                ) : (
                  <span className="badge badge-green">Čisto</span>
                )}
              </Link>
            );
          })}
        </section>

        <section className="card mt-8 p-5">
          <h2 className="font-semibold text-ink">Pridruži se ligi</h2>
          <p className="mt-1 text-sm text-muted">
            Upiši pozivni kod koji ti je poslao administrator lige.
          </p>
          <form action={joinByCode} className="mt-4 flex gap-2">
            <input
              name="code"
              placeholder="npr. VATRENI1"
              autoCapitalize="characters"
              autoComplete="off"
              className="input flex-1 font-mono uppercase tracking-widest"
            />
            <button className="btn btn-outline">Pridruži se</button>
          </form>
        </section>
      </main>
    </div>
  );
}
