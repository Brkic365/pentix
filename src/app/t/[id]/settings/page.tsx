import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/users";
import { parsePentixConfig, PHASES, PHASE_LABELS_HR } from "@/lib/config";
import {
  applyElimination,
  finishTournament,
  regenerateInvite,
  setMainCountry,
  updateConfig,
  updateMember,
} from "@/actions/tournaments";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 focus:border-volt focus:outline-none";
const labelCls = "block text-xs uppercase tracking-wider text-muted mb-1";

function NumberField({
  name,
  label,
  defaultValue,
  step = "any",
}: {
  name: string;
  label: string;
  defaultValue: number;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        defaultValue={defaultValue}
        className={inputCls}
      />
    </div>
  );
}

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
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 pb-24">
      <header className="flex items-center gap-3 py-4">
        <Link href={`/t/${id}`} className="text-muted">
          ←
        </Link>
        <div>
          <h1 className="font-display text-2xl">POSTAVKE</h1>
          <p className="text-xs text-muted">{tournament.name}</p>
        </div>
      </header>

      {/* Invite */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg">POZOVI EKIPU</h2>
        <p className="mt-1 text-sm text-muted">
          Kod: <span className="font-mono text-ink">{tournament.inviteCode}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton text={inviteUrl} label="Kopiraj link" />
          <CopyButton text={tournament.inviteCode} label="Kopiraj kod" />
          <form action={regenerateInviteForT}>
            <ConfirmSubmit
              message="Stari link prestaje vrijediti. Sigurno?"
              className="rounded-xl border border-line px-4 py-2 text-sm text-muted"
            >
              Novi kod
            </ConfirmSubmit>
          </form>
        </div>
      </section>

      {/* Main country */}
      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg">GLAVNA REPREZENTACIJA</h2>
        <form action={setMainCountryForT} className="mt-3 flex gap-2">
          <select
            name="mainCountryId"
            defaultValue={tournament.mainCountryId}
            className={`${inputCls} flex-1`}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-ink px-4 text-sm font-semibold text-pitch">
            Spremi
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Praćenje utakmica se automatski osvježava za mečeve bez golova.
        </p>
      </section>

      {/* Formula */}
      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg">FORMULA DUGA</h2>
        <form action={updateConfigForT} className="mt-3 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <NumberField name="baseReps" label="Baza (penta!)" defaultValue={cfg.baseReps} step="1" />
            <NumberField
              name="mainTeamGoalMultiplier"
              label="× naš gol"
              defaultValue={cfg.mainTeamGoalMultiplier}
            />
            <NumberField
              name="concededGoalMultiplier"
              label="× primljeni"
              defaultValue={cfg.concededGoalMultiplier}
            />
          </div>

          <div>
            <div className={labelCls}>Množitelji po fazi</div>
            <div className="grid grid-cols-4 gap-2">
              {PHASES.map((p) => (
                <div key={p}>
                  <label htmlFor={`pm_${p}`} className="block text-[10px] text-muted">
                    {PHASE_LABELS_HR[p]}
                  </label>
                  <input
                    id={`pm_${p}`}
                    name={`pm_${p}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    defaultValue={cfg.phaseMultipliers[p]}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              name="eliminationPenalty"
              label="Kazna za ispadanje"
              defaultValue={cfg.eliminationPenalty}
              step="1"
            />
            <div>
              <label className={labelCls}>Prati i tuđe utakmice</label>
              <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                <input
                  type="checkbox"
                  name="trackNeutralMatches"
                  defaultChecked={cfg.trackNeutralMatches}
                  className="size-4 accent-volt"
                />
                <span className="text-sm">neutralne ×1</span>
              </label>
            </div>
          </div>

          <div>
            <div className={labelCls}>Bonus za plasman (kolektivna patnja)</div>
            <div className="grid grid-cols-3 gap-3">
              <NumberField name="ttb_first" label="1. mjesto" defaultValue={cfg.topThreeBonus.first} step="1" />
              <NumberField name="ttb_second" label="2. mjesto" defaultValue={cfg.topThreeBonus.second} step="1" />
              <NumberField name="ttb_third" label="3. mjesto" defaultValue={cfg.topThreeBonus.third} step="1" />
            </div>
          </div>

          <div>
            <div className={labelCls}>Flat bonusi (ne množe se s fazom)</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label htmlFor="favoritePlayerName" className={labelCls}>
                  Omiljeni igrač
                </label>
                <input
                  id="favoritePlayerName"
                  name="favoritePlayerName"
                  defaultValue={cfg.flatBonuses.favoritePlayerName}
                  className={inputCls}
                />
              </div>
              <NumberField
                name="favoritePlayerGoal"
                label="+ njegov gol"
                defaultValue={cfg.flatBonuses.favoritePlayerGoal}
                step="1"
              />
              <NumberField
                name="lateGoal"
                label="+ kasni gol (85'+)"
                defaultValue={cfg.flatBonuses.lateGoal}
                step="1"
              />
              <NumberField
                name="penaltyGoal"
                label="± gol iz penala"
                defaultValue={cfg.flatBonuses.penaltyGoal}
                step="1"
              />
              <div>
                <label className={labelCls}>Hat-trick</label>
                <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                  <input
                    type="checkbox"
                    name="hatTrickThirdGoalDoubles"
                    defaultChecked={cfg.flatBonuses.hatTrickThirdGoalDoubles}
                    className="size-4 accent-volt"
                  />
                  <span className="text-sm">3. gol ×2</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <div className={labelCls}>Kamata (kamatari ne spavaju)</div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                name="interestDailyRate"
                label="Dnevna stopa (0.05 = 5%)"
                defaultValue={cfg.interest.dailyRate}
              />
              <NumberField
                name="interestCapMultiplier"
                label="Strop (× glavnice)"
                defaultValue={cfg.interest.capMultiplier}
              />
            </div>
          </div>

          <div>
            <div className={labelCls}>Jedanaesterci (raspucavanje)</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Uključeno</label>
                <label className="flex items-center justify-center rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                  <input
                    type="checkbox"
                    name="shootoutEnabled"
                    defaultChecked={cfg.shootout.enabled}
                    className="size-4 accent-volt"
                  />
                </label>
              </div>
              <NumberField
                name="shootoutEveryoneReps"
                label="Svi dobiju"
                defaultValue={cfg.shootout.everyoneReps}
                step="1"
              />
              <NumberField
                name="shootoutPerMissBonus"
                label="+ po promašaju"
                defaultValue={cfg.shootout.perMissBonus}
                step="1"
              />
            </div>
          </div>

          <button className="w-full rounded-xl bg-volt py-3 font-display text-lg text-pitch">
            SPREMI FORMULU
          </button>
        </form>
      </section>

      {/* Members */}
      <section className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg">EKIPA I HANDICAP</h2>
        <p className="mt-1 text-xs text-muted">
          Handicap množi samo nakupljanje duga — sklek je sklek, plaćanje je
          uvijek 1:1. Okvirno: ležeran 1.0 / fit 1.2 / zvijer 1.5 (max 2.0).
        </p>
        <div className="mt-3 space-y-3">
          {members.map((m) => (
            <form
              key={m.id}
              action={updateMemberForT}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-3"
            >
              <input type="hidden" name="memberId" value={m.id} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {m.user.displayName}
                </div>
                <div className="text-[11px] text-muted">
                  od {new Date(m.joinedAt).toLocaleDateString("hr-HR")}
                </div>
              </div>
              <input
                name="handicapMultiplier"
                type="number"
                step="0.1"
                min="0.5"
                max="2"
                defaultValue={m.handicapMultiplier}
                className="w-20 rounded-lg border border-line bg-surface px-2 py-2 text-center"
                aria-label="Handicap"
              />
              <select
                name="role"
                defaultValue={m.role}
                className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
                aria-label="Uloga"
              >
                <option value="PLAYER">Igrač</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-pitch">
                OK
              </button>
            </form>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      <section className="mt-4 rounded-2xl border border-debt/40 bg-surface p-5">
        <h2 className="font-display text-lg text-debt">CRNI SCENARIJI</h2>

        <div className="mt-3 space-y-3">
          <form action={applyEliminationForT}>
            <ConfirmSubmit
              message={`Svi članovi dobivaju ${cfg.eliminationPenalty} sklekova (× handicap). Ovo se može samo jednom. Sigurno?`}
              className="w-full rounded-xl border border-debt/50 bg-debt/10 py-3 font-semibold text-debt disabled:opacity-40"
            >
              {tournament.eliminatedAt
                ? "Ispadanje već naplaćeno 💀"
                : `${tournament.mainCountry.name} je ispala (+${cfg.eliminationPenalty})`}
            </ConfirmSubmit>
          </form>

          {tournament.status !== "FINISHED" ? (
            <form action={finishTournamentForT} className="flex gap-2">
              <select name="placement" className={`${inputCls} flex-1`} defaultValue="0">
                <option value="0">Bez podija</option>
                <option value="1">1. mjesto (+{cfg.topThreeBonus.first})</option>
                <option value="2">2. mjesto (+{cfg.topThreeBonus.second})</option>
                <option value="3">3. mjesto (+{cfg.topThreeBonus.third})</option>
              </select>
              <ConfirmSubmit
                message="Završavaš turnir i primjenjuješ bonus za plasman. Sigurno?"
                className="rounded-xl border border-line px-4 text-sm font-semibold"
              >
                Završi turnir
              </ConfirmSubmit>
            </form>
          ) : (
            <p className="text-sm text-muted">
              Turnir je završen
              {tournament.finalPlacement
                ? ` — ${tournament.finalPlacement}. mjesto.`
                : "."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
