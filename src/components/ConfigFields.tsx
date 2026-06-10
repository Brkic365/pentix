import { PHASES, PHASE_LABELS_HR, type PentixConfig } from "@/lib/config";

/**
 * The shared formula editor — same field names everywhere, parsed by
 * lib/configForm.ts. Used on tournament creation and in settings.
 */

function Num({
  name,
  label,
  defaultValue,
  step = "any",
  hint,
}: {
  name: string;
  label: string;
  defaultValue: number;
  step?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        defaultValue={defaultValue}
        className="input"
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-card-subtle px-3 py-2.5 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{title}</legend>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

export function ConfigFields({ config }: { config: PentixConfig }) {
  return (
    <div className="space-y-7">
      <Group
        title="Osnovni iznosi"
        description="Dug po golu = baza × množitelj faze × množitelj strane, plus fiksni bonusi."
      >
        <div className="grid grid-cols-3 gap-3">
          <Num name="baseReps" label="Baza (sklekova)" defaultValue={config.baseReps} step="1" />
          <Num
            name="mainTeamGoalMultiplier"
            label="× naš gol"
            defaultValue={config.mainTeamGoalMultiplier}
          />
          <Num
            name="concededGoalMultiplier"
            label="× primljeni gol"
            defaultValue={config.concededGoalMultiplier}
          />
        </div>
      </Group>

      <Group title="Množitelji po fazi natjecanja">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {PHASES.map((p) => (
            <Num
              key={p}
              name={`pm_${p}`}
              label={PHASE_LABELS_HR[p]}
              defaultValue={config.phaseMultipliers[p]}
            />
          ))}
        </div>
      </Group>

      <Group
        title="Fiksni bonusi"
        description="Dodaju se na kraju i ne množe se s fazom. Negativan iznos smanjuje dug."
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="favoritePlayerName" className="label">
              Omiljeni igrač
            </label>
            <input
              id="favoritePlayerName"
              name="favoritePlayerName"
              defaultValue={config.flatBonuses.favoritePlayerName}
              className="input"
            />
          </div>
          <Num
            name="favoritePlayerGoal"
            label="+ njegov gol"
            defaultValue={config.flatBonuses.favoritePlayerGoal}
            step="1"
          />
          <Num
            name="lateGoal"
            label="+ kasni gol (85′+)"
            defaultValue={config.flatBonuses.lateGoal}
            step="1"
          />
          <Num
            name="penaltyGoal"
            label="± gol iz jedanaesterca"
            defaultValue={config.flatBonuses.penaltyGoal}
            step="1"
          />
          <div className="col-span-2">
            <Toggle
              name="hatTrickThirdGoalDoubles"
              label="Treći gol istog igrača udvostručuje osnovni iznos (hat-trick)"
              defaultChecked={config.flatBonuses.hatTrickThirdGoalDoubles}
            />
          </div>
        </div>
      </Group>

      <Group
        title="Posebni događaji"
        description="Jednokratna zaduženja za cijelu ekipu."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num
            name="eliminationPenalty"
            label="Ispadanje"
            defaultValue={config.eliminationPenalty}
            step="1"
          />
          <Num name="ttb_first" label="1. mjesto" defaultValue={config.topThreeBonus.first} step="1" />
          <Num name="ttb_second" label="2. mjesto" defaultValue={config.topThreeBonus.second} step="1" />
          <Num name="ttb_third" label="3. mjesto" defaultValue={config.topThreeBonus.third} step="1" />
        </div>
      </Group>

      <Group
        title="Jedanaesterci (raspucavanje)"
        description="Ako praćena utakmica ode na penale."
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 sm:col-span-1">
            <Toggle
              name="shootoutEnabled"
              label="Uključeno"
              defaultChecked={config.shootout.enabled}
            />
          </div>
          <Num
            name="shootoutEveryoneReps"
            label="Svi dobiju"
            defaultValue={config.shootout.everyoneReps}
            step="1"
          />
          <Num
            name="shootoutPerMissBonus"
            label="+ po promašaju"
            defaultValue={config.shootout.perMissBonus}
            step="1"
          />
        </div>
      </Group>

      <Group
        title="Kamata"
        description="Dnevno se obračunava na neplaćeni dug; ukupna kamata je ograničena stropom."
      >
        <div className="grid grid-cols-2 gap-3">
          <Num
            name="interestDailyRate"
            label="Dnevna stopa"
            defaultValue={config.interest.dailyRate}
            hint="0.05 = 5% dnevno"
          />
          <Num
            name="interestCapMultiplier"
            label="Strop (× glavnice)"
            defaultValue={config.interest.capMultiplier}
            hint="3 = dug može narasti najviše na trostruko"
          />
        </div>
      </Group>

      <Group title="Neutralne utakmice">
        <Toggle
          name="trackNeutralMatches"
          label="Dopusti praćenje utakmica bez glavne reprezentacije (množitelj ×1)"
          defaultChecked={config.trackNeutralMatches}
        />
      </Group>
    </div>
  );
}
