import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/users";
import { DEFAULT_CONFIG } from "@/lib/config";
import { createTournament } from "@/actions/tournaments";
import { AppHeader } from "@/components/AppHeader";
import { ConfigFields } from "@/components/ConfigFields";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  await requireUser();
  const teams = await db.team.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Natrag na lige
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            Nova liga
          </h1>
          <p className="mt-1 text-sm text-muted">
            Raspored svih 104 utakmice SP-a 2026 učitava se automatski.
          </p>
        </div>

        <form action={createTournament} className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-ink">Osnovno</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="name" className="label">
                  Naziv lige
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  maxLength={60}
                  placeholder="npr. Sklekovi za vatrene"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="mainCountryId" className="label">
                  Glavna reprezentacija
                </label>
                <select
                  id="mainCountryId"
                  name="mainCountryId"
                  defaultValue={46}
                  className="input"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.groupLetter ? ` — skupina ${t.groupLetter}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted">
                  Njeni golovi i primljeni golovi stvaraju dug; njene utakmice
                  prate se automatski.
                </p>
              </div>
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-ink">Formula duga</h2>
            <p className="mt-1 text-sm text-muted">
              Postavljena je preporučena formula — slobodno je prilagodi ekipi.
              Sve vrijednosti administratori mogu mijenjati i kasnije, u
              postavkama lige.
            </p>
            <div className="mt-6">
              <ConfigFields config={DEFAULT_CONFIG} />
            </div>
          </section>

          <button className="btn btn-primary w-full py-3 text-base">
            Stvori ligu
          </button>
        </form>
      </main>
    </div>
  );
}
