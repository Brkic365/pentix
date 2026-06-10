import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/users";
import { parsePentixConfig } from "@/lib/config";
import {
  applyElimination,
  finishTournament,
  regenerateInvite,
  setMainCountry,
  updateConfig,
  updateMember,
} from "@/actions/tournaments";
import { AppShell } from "@/components/AppShell";
import { ConfigFields } from "@/components/ConfigFields";
import { FormulaPresetPicker } from "@/components/FormulaPresetPicker";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tournament } = await requireAdmin(id);
  const cfg = parsePentixConfig(tournament.config);

  const [teams, members] = await Promise.all([
    db.team.findMany({ orderBy: { name: "asc" } }),
    db.member.findMany({
      where: { tournamentId: id },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pentix.eu";
  const inviteUrl = `${appUrl}/join/${tournament.inviteCode}`;

  const updateConfigForT = updateConfig.bind(null, id);
  const setMainCountryForT = setMainCountry.bind(null, id);
  const updateMemberForT = updateMember.bind(null, id);
  const regenerateInviteForT = regenerateInvite.bind(null, id);
  const applyEliminationForT = applyElimination.bind(null, id);
  const finishTournamentForT = finishTournament.bind(null, id);

  return (
    <AppShell
      section="league-settings"
      league={{
        id,
        name: tournament.name,
        mainCountry: tournament.mainCountry,
        isAdmin: true,
      }}
    >
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="py-8">
          <Link
            href={`/t/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            {tournament.name}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            Postavke lige
          </h1>
        </div>

        <div className="space-y-6">
          {/* Invite */}
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-ink">Pozivnice</h2>
            <p className="mt-1 text-sm text-muted">
              Kod: <span className="font-mono font-medium text-ink">{tournament.inviteCode}</span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CopyButton text={inviteUrl} label="Kopiraj poveznicu" />
              <CopyButton text={tournament.inviteCode} label="Kopiraj kod" />
              <form action={regenerateInviteForT}>
                <ConfirmSubmit
                  message="Stari kod i poveznica prestaju vrijediti. Nastaviti?"
                  className="btn btn-ghost"
                >
                  Generiraj novi kod
                </ConfirmSubmit>
              </form>
            </div>
          </section>

          {/* Main country */}
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-ink">Glavna reprezentacija</h2>
            <p className="mt-1 text-sm text-muted">
              Praćenje se automatski osvježava za utakmice koje još nemaju
              upisane golove.
            </p>
            <form action={setMainCountryForT} className="mt-4 flex gap-2">
              <select
                name="mainCountryId"
                defaultValue={tournament.mainCountryId}
                className="input flex-1"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-outline">Spremi</button>
            </form>
          </section>

          {/* Formula */}
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-ink">Formula duga</h2>
            <p className="mt-1 text-sm text-muted">
              Promjene vrijede od sljedećeg upisanog gola — već nastali dug se
              ne preračunava.
            </p>
            <form action={updateConfigForT} className="mt-4 space-y-6">
              <FormulaPresetPicker initialConfig={cfg} />
              <div className="border-t border-line pt-6">
                <ConfigFields config={cfg} />
              </div>
              <button className="btn btn-primary w-full">Spremi formulu</button>
            </form>
          </section>

          {/* Members */}
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold text-ink">Članovi i handicap</h2>
            <p className="mt-1 text-sm text-muted">
              Handicap množi samo nastajanje duga — plaćanje je uvijek 1:1.
              Orijentir: rekreativac 1.0 · fit 1.2 · zvijer 1.5 (najviše 2.0).
            </p>
            <div className="mt-4 space-y-2">
              {members.map((m) => (
                <form
                  key={m.id}
                  action={updateMemberForT}
                  className="flex items-center gap-2 rounded-lg border border-line bg-card-subtle p-3"
                >
                  <input type="hidden" name="memberId" value={m.id} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {m.user.displayName}
                    </div>
                    <div className="text-xs text-muted">
                      član od {new Date(m.joinedAt).toLocaleDateString("hr-HR")}
                    </div>
                  </div>
                  <input
                    name="handicapMultiplier"
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="2"
                    defaultValue={m.handicapMultiplier}
                    className="input w-20 text-center"
                    aria-label="Handicap"
                  />
                  <select
                    name="role"
                    defaultValue={m.role}
                    className="input w-auto"
                    aria-label="Uloga"
                  >
                    <option value="PLAYER">Igrač</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button className="btn btn-outline px-3 py-2">Spremi</button>
                </form>
              ))}
            </div>
          </section>

          {/* Danger zone */}
          <section className="card border-danger-soft-border p-5 sm:p-6">
            <h2 className="font-semibold text-danger">Završne radnje</h2>
            <p className="mt-1 text-sm text-muted">
              Jednokratna zaduženja za cijelu ekipu — pažljivo.
            </p>
            <div className="mt-4 space-y-3">
              <form action={applyEliminationForT}>
                <ConfirmSubmit
                  message={`Svi članovi dobivaju ${cfg.eliminationPenalty} sklekova (× handicap). Može se primijeniti samo jednom. Nastaviti?`}
                  className="btn btn-danger-outline w-full"
                >
                  {tournament.eliminatedAt
                    ? "Ispadanje je već naplaćeno"
                    : `${tournament.mainCountry.name} je ispala (+${cfg.eliminationPenalty} svima)`}
                </ConfirmSubmit>
              </form>

              {tournament.status !== "FINISHED" ? (
                <form action={finishTournamentForT} className="flex gap-2">
                  <select name="placement" className="input flex-1" defaultValue="0">
                    <option value="0">Bez podija</option>
                    <option value="1">1. mjesto (+{cfg.topThreeBonus.first} svima)</option>
                    <option value="2">2. mjesto (+{cfg.topThreeBonus.second} svima)</option>
                    <option value="3">3. mjesto (+{cfg.topThreeBonus.third} svima)</option>
                  </select>
                  <ConfirmSubmit
                    message="Liga se zaključava i primjenjuje se bonus za plasman. Nastaviti?"
                    className="btn btn-outline"
                  >
                    Završi ligu
                  </ConfirmSubmit>
                </form>
              ) : (
                <p className="text-sm text-muted">
                  Liga je završena
                  {tournament.finalPlacement
                    ? ` — ${tournament.finalPlacement}. mjesto.`
                    : "."}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
