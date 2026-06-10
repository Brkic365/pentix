import { describe, expect, it } from "vitest";
import { betOutcome } from "./bets";

describe("betOutcome", () => {
  it("HOME_WIN / AWAY_WIN / DRAW from final score", () => {
    expect(betOutcome("HOME_WIN", { homeScore: 2, awayScore: 1, mainIsHome: null })).toBe(true);
    expect(betOutcome("HOME_WIN", { homeScore: 1, awayScore: 1, mainIsHome: null })).toBe(false);
    expect(betOutcome("AWAY_WIN", { homeScore: 0, awayScore: 3, mainIsHome: null })).toBe(true);
    expect(betOutcome("DRAW", { homeScore: 2, awayScore: 2, mainIsHome: null })).toBe(true);
    expect(betOutcome("DRAW", { homeScore: 2, awayScore: 0, mainIsHome: null })).toBe(false);
  });

  it("OVER/UNDER 2.5 splits at 3 total goals", () => {
    expect(betOutcome("OVER_2_5", { homeScore: 2, awayScore: 1, mainIsHome: null })).toBe(true);
    expect(betOutcome("OVER_2_5", { homeScore: 1, awayScore: 1, mainIsHome: null })).toBe(false);
    expect(betOutcome("UNDER_2_5", { homeScore: 0, awayScore: 2, mainIsHome: null })).toBe(true);
    expect(betOutcome("UNDER_2_5", { homeScore: 3, awayScore: 1, mainIsHome: null })).toBe(false);
  });

  it("MAIN_WIN respects which side the main country is on", () => {
    expect(betOutcome("MAIN_WIN", { homeScore: 2, awayScore: 0, mainIsHome: true })).toBe(true);
    expect(betOutcome("MAIN_WIN", { homeScore: 2, awayScore: 0, mainIsHome: false })).toBe(false);
    expect(betOutcome("MAIN_WIN", { homeScore: 0, awayScore: 1, mainIsHome: false })).toBe(true);
  });

  it("MAIN_NOT_WIN includes draws", () => {
    expect(betOutcome("MAIN_NOT_WIN", { homeScore: 1, awayScore: 1, mainIsHome: true })).toBe(true);
    expect(betOutcome("MAIN_NOT_WIN", { homeScore: 2, awayScore: 1, mainIsHome: true })).toBe(false);
  });

  it("cannot auto-resolve CUSTOM or MAIN_* without main country", () => {
    expect(betOutcome("CUSTOM", { homeScore: 1, awayScore: 0, mainIsHome: true })).toBeNull();
    expect(betOutcome("MAIN_WIN", { homeScore: 1, awayScore: 0, mainIsHome: null })).toBeNull();
    expect(betOutcome("MAIN_NOT_WIN", { homeScore: 1, awayScore: 0, mainIsHome: null })).toBeNull();
  });
});
