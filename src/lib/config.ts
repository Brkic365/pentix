import { z } from "zod";

export const PHASES = ["GROUP", "R32", "R16", "QF", "SF", "THIRD", "FINAL"] as const;
export type PhaseKey = (typeof PHASES)[number];

export const PHASE_LABELS_HR: Record<PhaseKey, string> = {
  GROUP: "Skupina",
  R32: "Šesnaestina finala",
  R16: "Osmina finala",
  QF: "Četvrtfinale",
  SF: "Polufinale",
  THIRD: "Za 3. mjesto",
  FINAL: "Finale",
};

const phaseMultipliersSchema = z.object({
  GROUP: z.number().min(0),
  R32: z.number().min(0),
  R16: z.number().min(0),
  QF: z.number().min(0),
  SF: z.number().min(0),
  THIRD: z.number().min(0),
  FINAL: z.number().min(0),
});

export const pentixConfigSchema = z.object({
  baseReps: z.number().int().min(0),
  phaseMultipliers: phaseMultipliersSchema,
  mainTeamGoalMultiplier: z.number().min(0),
  concededGoalMultiplier: z.number().min(0),
  trackNeutralMatches: z.boolean(),
  eliminationPenalty: z.number().int().min(0),
  topThreeBonus: z.object({
    first: z.number().int().min(0),
    second: z.number().int().min(0),
    third: z.number().int().min(0),
  }),
  flatBonuses: z.object({
    favoritePlayerName: z.string(),
    favoritePlayerGoal: z.number(),
    lateGoal: z.number(),
    penaltyGoal: z.number(),
    hatTrickThirdGoalDoubles: z.boolean(),
  }),
  interest: z.object({
    dailyRate: z.number().min(0).max(1),
    capMultiplier: z.number().min(1),
  }),
  shootout: z.object({
    enabled: z.boolean(),
    everyoneReps: z.number().int().min(0),
    perMissBonus: z.number().int().min(0),
  }),
});

export type PentixConfig = z.infer<typeof pentixConfigSchema>;

export const DEFAULT_CONFIG: PentixConfig = {
  baseReps: 5,
  phaseMultipliers: {
    GROUP: 1,
    R32: 1.25,
    R16: 1.5,
    QF: 2,
    SF: 3,
    THIRD: 4,
    FINAL: 5,
  },
  mainTeamGoalMultiplier: 3,
  concededGoalMultiplier: 4,
  trackNeutralMatches: false,
  eliminationPenalty: 100,
  topThreeBonus: { first: 0, second: 50, third: 150 },
  flatBonuses: {
    favoritePlayerName: "Livaja",
    favoritePlayerGoal: 20,
    lateGoal: 10,
    penaltyGoal: -2,
    hatTrickThirdGoalDoubles: true,
  },
  interest: { dailyRate: 0.05, capMultiplier: 3 },
  shootout: { enabled: true, everyoneReps: 30, perMissBonus: 5 },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : override) as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    if (key in base) {
      out[key] = deepMerge(
        (base as Record<string, unknown>)[key],
        override[key],
      );
    }
    // unknown keys are dropped — keeps stored config forward-compatible
  }
  return out as T;
}

/**
 * Parse a stored tournament config. Unknown/missing keys fall back to
 * defaults, so old tournaments keep working when the config shape grows.
 */
export function parsePentixConfig(json: unknown): PentixConfig {
  const merged = deepMerge(DEFAULT_CONFIG, json ?? {});
  const result = pentixConfigSchema.safeParse(merged);
  return result.success ? result.data : DEFAULT_CONFIG;
}
