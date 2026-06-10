import { pentixConfigSchema, type PentixConfig } from "@/lib/config";

/**
 * Parses the shared formula form (see components/ConfigFields.tsx) — used by
 * both tournament creation and the settings editor.
 */
export function parseConfigFormData(formData: FormData): PentixConfig {
  const raw = {
    baseReps: Number(formData.get("baseReps")),
    phaseMultipliers: {
      GROUP: Number(formData.get("pm_GROUP")),
      R32: Number(formData.get("pm_R32")),
      R16: Number(formData.get("pm_R16")),
      QF: Number(formData.get("pm_QF")),
      SF: Number(formData.get("pm_SF")),
      THIRD: Number(formData.get("pm_THIRD")),
      FINAL: Number(formData.get("pm_FINAL")),
    },
    mainTeamGoalMultiplier: Number(formData.get("mainTeamGoalMultiplier")),
    concededGoalMultiplier: Number(formData.get("concededGoalMultiplier")),
    trackNeutralMatches: formData.get("trackNeutralMatches") === "on",
    eliminationPenalty: Number(formData.get("eliminationPenalty")),
    topThreeBonus: {
      first: Number(formData.get("ttb_first")),
      second: Number(formData.get("ttb_second")),
      third: Number(formData.get("ttb_third")),
    },
    flatBonuses: {
      favoritePlayerName: String(formData.get("favoritePlayerName") ?? "").trim(),
      favoritePlayerGoal: Number(formData.get("favoritePlayerGoal")),
      lateGoal: Number(formData.get("lateGoal")),
      penaltyGoal: Number(formData.get("penaltyGoal")),
      hatTrickThirdGoalDoubles: formData.get("hatTrickThirdGoalDoubles") === "on",
    },
    interest: {
      dailyRate: Number(formData.get("interestDailyRate")),
      capMultiplier: Number(formData.get("interestCapMultiplier")),
    },
    shootout: {
      enabled: formData.get("shootoutEnabled") === "on",
      everyoneReps: Number(formData.get("shootoutEveryoneReps")),
      perMissBonus: Number(formData.get("shootoutPerMissBonus")),
    },
  };

  const parsed = pentixConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Neispravne vrijednosti formule.");
  }
  return parsed.data;
}

/** True when the submitted form contains the formula fields at all. */
export function hasConfigFields(formData: FormData): boolean {
  return formData.has("baseReps");
}
