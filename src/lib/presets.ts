import { DEFAULT_CONFIG, type PentixConfig } from "@/lib/config";

/**
 * Formula presets — starting points for the ConfigFields editor. Selecting
 * one fills the form; every value stays individually editable afterwards.
 */
export interface FormulaPreset {
  key: string;
  name: string;
  tagline: string;
  /** headline numbers shown on the preset card */
  highlights: string[];
  config: PentixConfig;
}

export const FORMULA_PRESETS: FormulaPreset[] = [
  {
    key: "lagana",
    name: "Lagana liga",
    tagline: "Za miješane ekipe i prvi turnir — manji iznosi, blaga kamata.",
    highlights: ["3 po golu", "kamata 2%", "ispadanje +50"],
    config: {
      ...DEFAULT_CONFIG,
      baseReps: 3,
      mainTeamGoalMultiplier: 2,
      concededGoalMultiplier: 3,
      eliminationPenalty: 50,
      topThreeBonus: { first: 0, second: 30, third: 80 },
      flatBonuses: {
        ...DEFAULT_CONFIG.flatBonuses,
        favoritePlayerGoal: 10,
        lateGoal: 5,
        penaltyGoal: -1,
      },
      interest: { dailyRate: 0.02, capMultiplier: 2 },
      shootout: { enabled: true, everyoneReps: 15, perMissBonus: 3 },
    },
  },
  {
    key: "klasika",
    name: "Klasika",
    tagline: "Preporučeni omjeri — penta znači pet sklekova po golu.",
    highlights: ["5 po golu", "kamata 5%", "ispadanje +100"],
    config: DEFAULT_CONFIG,
  },
  {
    key: "hardcore",
    name: "Hardcore",
    tagline: "Za ekipe koje ne opraštaju — dvostruke tarife, kamata grize.",
    highlights: ["10 po golu", "kamata 10%", "ispadanje +250"],
    config: {
      ...DEFAULT_CONFIG,
      baseReps: 10,
      mainTeamGoalMultiplier: 3,
      concededGoalMultiplier: 5,
      eliminationPenalty: 250,
      topThreeBonus: { first: 0, second: 100, third: 250 },
      flatBonuses: {
        ...DEFAULT_CONFIG.flatBonuses,
        favoritePlayerGoal: 30,
        lateGoal: 20,
        penaltyGoal: -5,
      },
      interest: { dailyRate: 0.1, capMultiplier: 4 },
      shootout: { enabled: true, everyoneReps: 50, perMissBonus: 10 },
    },
  },
];

/** Maps a config onto the ConfigFields input names (see components/ConfigFields.tsx). */
export function configToFieldValues(
  c: PentixConfig,
): Record<string, string | boolean> {
  return {
    baseReps: String(c.baseReps),
    pm_GROUP: String(c.phaseMultipliers.GROUP),
    pm_R32: String(c.phaseMultipliers.R32),
    pm_R16: String(c.phaseMultipliers.R16),
    pm_QF: String(c.phaseMultipliers.QF),
    pm_SF: String(c.phaseMultipliers.SF),
    pm_THIRD: String(c.phaseMultipliers.THIRD),
    pm_FINAL: String(c.phaseMultipliers.FINAL),
    mainTeamGoalMultiplier: String(c.mainTeamGoalMultiplier),
    concededGoalMultiplier: String(c.concededGoalMultiplier),
    trackNeutralMatches: c.trackNeutralMatches,
    eliminationPenalty: String(c.eliminationPenalty),
    ttb_first: String(c.topThreeBonus.first),
    ttb_second: String(c.topThreeBonus.second),
    ttb_third: String(c.topThreeBonus.third),
    favoritePlayerName: c.flatBonuses.favoritePlayerName,
    favoritePlayerGoal: String(c.flatBonuses.favoritePlayerGoal),
    lateGoal: String(c.flatBonuses.lateGoal),
    penaltyGoal: String(c.flatBonuses.penaltyGoal),
    hatTrickThirdGoalDoubles: c.flatBonuses.hatTrickThirdGoalDoubles,
    interestDailyRate: String(c.interest.dailyRate),
    interestCapMultiplier: String(c.interest.capMultiplier),
    shootoutEnabled: c.shootout.enabled,
    shootoutEveryoneReps: String(c.shootout.everyoneReps),
    shootoutPerMissBonus: String(c.shootout.perMissBonus),
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

/** Which preset (if any) a config currently matches. */
export function matchPresetKey(config: PentixConfig): string | null {
  return FORMULA_PRESETS.find((p) => deepEqual(p.config, config))?.key ?? null;
}
