/**
 * Pure accrual engine — no I/O, no Prisma. Everything that turns a football
 * event into pushup debt lives here so it can be unit-tested exhaustively.
 *
 * Rounding policy: ledger amounts are whole pushups. Per-member accruals are
 * rounded half-up after the handicap multiplier is applied.
 */
import type { PentixConfig, PhaseKey } from "@/lib/config";

export type GoalSide = "MAIN" | "AGAINST" | "NEUTRAL";

export interface GoalAccrualInput {
  phase: PhaseKey;
  side: GoalSide;
  scorerName: string;
  isPenalty: boolean;
  isOwnGoal: boolean;
  isLate: boolean;
  /** 1-based count of goals by this scorer in this match, including this one */
  nthGoalBySamePlayer: number;
}

export interface GoalBaseResult {
  /** baseReps × phaseMult × teamMult (× 2 if hat-trick third goal) */
  raw: number;
  /** sum of flat bonuses (NOT phase-multiplied) */
  flat: number;
  /** G = max(0, raw + flat) — per-member debt before handicap */
  base: number;
  teamMult: number;
  phaseMult: number;
  hatTrickApplied: boolean;
  favoritePlayerApplied: boolean;
  lateGoalApplied: boolean;
  penaltyGoalApplied: boolean;
}

/** Diacritics-insensitive, case-insensitive containment ("livaja" ∈ "Marko LIVAJA") */
export function scorerMatchesFavorite(scorerName: string, favoriteName: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .trim();
  const fav = norm(favoriteName);
  if (!fav) return false;
  return norm(scorerName).includes(fav);
}

/** Which side a goal falls on, relative to the tournament's main country. */
export function goalSide(params: {
  scoringTeamId: number;
  mainCountryId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
}): GoalSide {
  const { scoringTeamId, mainCountryId, homeTeamId, awayTeamId } = params;
  if (scoringTeamId === mainCountryId) return "MAIN";
  if (homeTeamId === mainCountryId || awayTeamId === mainCountryId) return "AGAINST";
  return "NEUTRAL";
}

/**
 * Compute G, the group-wide debt for one goal (before per-member handicap).
 *
 * Own goals: the goal still counts for the team it's credited to (side/raw
 * are unaffected), but the listed scorer didn't really "score" — so own goals
 * never trigger the favorite-player bonus or the hat-trick doubling.
 */
export function computeGoalBase(cfg: PentixConfig, goal: GoalAccrualInput): GoalBaseResult {
  const phaseMult = cfg.phaseMultipliers[goal.phase];
  const teamMult =
    goal.side === "MAIN"
      ? cfg.mainTeamGoalMultiplier
      : goal.side === "AGAINST"
        ? cfg.concededGoalMultiplier
        : 1;

  let raw = cfg.baseReps * phaseMult * teamMult;

  const hatTrickApplied =
    cfg.flatBonuses.hatTrickThirdGoalDoubles &&
    goal.nthGoalBySamePlayer === 3 &&
    !goal.isOwnGoal;
  if (hatTrickApplied) raw *= 2;

  const favoritePlayerApplied =
    !goal.isOwnGoal &&
    scorerMatchesFavorite(goal.scorerName, cfg.flatBonuses.favoritePlayerName);
  const lateGoalApplied = goal.isLate;
  const penaltyGoalApplied = goal.isPenalty;

  let flat = 0;
  if (favoritePlayerApplied) flat += cfg.flatBonuses.favoritePlayerGoal;
  if (lateGoalApplied) flat += cfg.flatBonuses.lateGoal;
  if (penaltyGoalApplied) flat += cfg.flatBonuses.penaltyGoal;

  const base = Math.max(0, raw + flat);

  return {
    raw,
    flat,
    base,
    teamMult,
    phaseMult,
    hatTrickApplied,
    favoritePlayerApplied,
    lateGoalApplied,
    penaltyGoalApplied,
  };
}

/** Per-member accrual: handicap scales debt, rounded to whole pushups. */
export function memberAccrualAmount(base: number, handicapMultiplier: number): number {
  return Math.round(base * handicapMultiplier);
}

/** Elimination penalty per member (handicap applies — it's an accrual). */
export function eliminationAmount(cfg: PentixConfig, handicapMultiplier: number): number {
  return Math.round(cfg.eliminationPenalty * handicapMultiplier);
}

/**
 * Top-three "bonus" debt per member based on mainCountry's final placement
 * (1, 2 or 3 — anything else yields 0). Collective suffering, handicap applies.
 */
export function topThreeAmount(
  cfg: PentixConfig,
  placement: number,
  handicapMultiplier: number,
): number {
  const flat =
    placement === 1
      ? cfg.topThreeBonus.first
      : placement === 2
        ? cfg.topThreeBonus.second
        : placement === 3
          ? cfg.topThreeBonus.third
          : 0;
  return Math.round(flat * handicapMultiplier);
}

/** Shootout debt per member: everyoneReps + perMissBonus × misses, × handicap. */
export function shootoutAmount(
  cfg: PentixConfig,
  missedPenalties: number,
  handicapMultiplier: number,
): number {
  if (!cfg.shootout.enabled) return 0;
  const base = cfg.shootout.everyoneReps + cfg.shootout.perMissBonus * Math.max(0, missedPenalties);
  return Math.round(base * handicapMultiplier);
}
