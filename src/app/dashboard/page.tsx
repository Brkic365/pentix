import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/users";
import { computeDebt } from "@/lib/engine/interest";
import { createTournament, joinByCode } from "@/actions/tournaments";
import { PentixLogo } from "@/components/PentixLogo";
import { sklekova } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

  const [memberships, teams] = await Promise.all([
    db.member.findMany({
      where: { userId: user.id },
      include: {
        tournament: { include: { mainCountry: true } },
        ledgerEntries: { select: { amount: true, type: true, createdAt: true } },
      },
      orderBy: { joinedAt: "desc" },
    }),
    db.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 pb-16">
      <header className="flex items-center justify-between py-4">
        <PentixLogo size={28} />
        <AuthButton />
      </header>

      <h1 className="font-display mt-2 text-3xl">TVOJE LIGE</h1>
      <p className="mt-1 text-sm text-muted">
        Bok, {user.displayName}. Dug te čeka.
      </p>

      {error === "kod" && (
        <p className="mt-4 rounded-xl border border-debt/40 bg-debt/10 px-4 py-3 text-sm text-debt">
          Taj pozivni kod ne postoji. Provjeri još jednom.
        </p>
      )}

      <section className="mt-5 space-y-3">
        {memberships.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface p-5 text-center text-sm text-muted">
            Još nisi ni u jednoj ligi. Napravi svoju ili upiši pozivni kod —
            sklekovi se sami neće odraditi.
          </div>
        )}
        {memberships.map((m) => {
          const debt = computeDebt(m.ledgerEntries);
          return (
            <Link
              key={m.id}
              href={`/t/${m.tournamentId}`}
              className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-volt/50"
            >
              <div>
                <div className="font-semibold">{m.tournament.name}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {m.tournament.mainCountry.name}
                  {m.tournament.status === "FINISHED" && " · završeno"}
                  {m.role === "ADMIN" && " · admin"}
                </div>
              </div>
              <div
                className={`rounded-xl px-3 py-2 text-right font-display text-lg ${
                  debt.outstanding > 0
                    ? "bg-debt/15 text-debt"
                    : "bg-volt/15 text-volt"
                }`}
              >
                {debt.outstanding > 0 ? sklekova(debt.outstanding) : "ČIST ✓"}
              </div>
            </Link>
          );
        })}
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-xl">UĐI U LIGU</h2>
        <form action={joinByCode} className="mt-3 flex gap-2">
          <input
            name="code"
            placeholder="POZIVNI KOD"
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 py-3 font-mono uppercase tracking-widest placeholder:text-muted/60 focus:border-volt focus:outline-none"
          />
          <button className="rounded-xl bg-ink px-5 font-semibold text-pitch">
            Uđi
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-xl">NOVA LIGA</h2>
        <form action={createTournament} className="mt-3 space-y-3">
          <input
            name="name"
            required
            maxLength={60}
            placeholder="Naziv (npr. Sklekovi za vatrene)"
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 placeholder:text-muted/60 focus:border-volt focus:outline-none"
          />
          <div>
            <label className="text-xs uppercase tracking-wider text-muted">
              Glavna reprezentacija — njeni golovi (i primljeni) prave dug
            </label>
            <select
              name="mainCountryId"
              defaultValue={46}
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 focus:border-volt focus:outline-none"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.groupLetter ? `(skupina ${t.groupLetter})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="w-full rounded-xl bg-volt px-5 py-3 font-display text-lg text-pitch">
            KRENI — 5 PO GOLU
          </button>
        </form>
      </section>
    </main>
  );
}
