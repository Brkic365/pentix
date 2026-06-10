/**
 * Bet term semantics — pure, unit-tested. The proposer claims the statement
 * is true at full time; if it holds the proposer wins, otherwise the opponent.
 */

export type BetTermsKey =
  | "MAIN_WIN"
  | "MAIN_NOT_WIN"
  | "HOME_WIN"
  | "AWAY_WIN"
  | "DRAW"
  | "OVER_2_5"
  | "UNDER_2_5"
  | "CUSTOM";

export interface BetMatchContext {
  homeScore: number;
  awayScore: number;
  /** true/false when the tournament's main country plays in this match, null otherwise */
  mainIsHome: boolean | null;
}

/**
 * Whether the proposer's claim came true. Returns null when the bet cannot be
 * auto-resolved (CUSTOM, or a MAIN_* bet on a match without the main country)
 * — those wait for a manual admin decision.
 */
export function betOutcome(terms: BetTermsKey, ctx: BetMatchContext): boolean | null {
  const { homeScore, awayScore, mainIsHome } = ctx;
  switch (terms) {
    case "HOME_WIN":
      return homeScore > awayScore;
    case "AWAY_WIN":
      return awayScore > homeScore;
    case "DRAW":
      return homeScore === awayScore;
    case "OVER_2_5":
      return homeScore + awayScore >= 3;
    case "UNDER_2_5":
      return homeScore + awayScore < 3;
    case "MAIN_WIN":
      if (mainIsHome === null) return null;
      return mainIsHome ? homeScore > awayScore : awayScore > homeScore;
    case "MAIN_NOT_WIN":
      if (mainIsHome === null) return null;
      return mainIsHome ? homeScore <= awayScore : awayScore <= homeScore;
    case "CUSTOM":
      return null;
  }
}

export function betTermsLabel(
  terms: BetTermsKey,
  names: { home: string; away: string; main: string },
  customText?: string | null,
): string {
  switch (terms) {
    case "MAIN_WIN":
      return `${names.main} pobjeđuje`;
    case "MAIN_NOT_WIN":
      return `${names.main} ne pobjeđuje`;
    case "HOME_WIN":
      return `${names.home} pobjeđuje`;
    case "AWAY_WIN":
      return `${names.away} pobjeđuje`;
    case "DRAW":
      return "Neriješeno";
    case "OVER_2_5":
      return "Padaju 3+ gola";
    case "UNDER_2_5":
      return "Manje od 3 gola";
    case "CUSTOM":
      return customText?.trim() || "Posebna oklada";
  }
}
