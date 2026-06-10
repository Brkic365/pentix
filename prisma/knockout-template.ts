/**
 * WC2026 knockout fixtures (matches 73–104). The open dataset only ships the
 * 72 group games, so these rows carry the official knockout calendar with
 * teams left TBD — tournament admins assign teams as the bracket fills in.
 *
 * Venues are only set where officially announced (QFs: Boston/LA/KC/Miami,
 * SFs: Dallas/Atlanta, bronze: Miami, final: New York/New Jersey). Kickoff
 * times for knockout rounds default to 19:00 UTC and are admin-editable.
 */

export type KnockoutPhase = "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";

export interface KnockoutTemplate {
  id: number; // official match number
  phase: KnockoutPhase;
  kickoff: string; // ISO UTC
  stadiumId: number | null;
}

const at = (day: string, hour = 19) => `2026-07-${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const june = (day: string, hour = 19) => `2026-06-${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;

export const KNOCKOUT_TEMPLATE: KnockoutTemplate[] = [
  // Round of 32 — June 28 … July 3
  { id: 73, phase: "R32", kickoff: june("28", 16), stadiumId: null },
  { id: 74, phase: "R32", kickoff: june("28", 19), stadiumId: null },
  { id: 75, phase: "R32", kickoff: june("28", 22), stadiumId: null },
  { id: 76, phase: "R32", kickoff: june("29", 16), stadiumId: null },
  { id: 77, phase: "R32", kickoff: june("29", 19), stadiumId: null },
  { id: 78, phase: "R32", kickoff: june("29", 22), stadiumId: null },
  { id: 79, phase: "R32", kickoff: june("30", 16), stadiumId: null },
  { id: 80, phase: "R32", kickoff: june("30", 19), stadiumId: null },
  { id: 81, phase: "R32", kickoff: june("30", 22), stadiumId: null },
  { id: 82, phase: "R32", kickoff: at("01", 16), stadiumId: null },
  { id: 83, phase: "R32", kickoff: at("01", 19), stadiumId: null },
  { id: 84, phase: "R32", kickoff: at("01", 22), stadiumId: null },
  { id: 85, phase: "R32", kickoff: at("02", 17), stadiumId: null },
  { id: 86, phase: "R32", kickoff: at("02", 21), stadiumId: null },
  { id: 87, phase: "R32", kickoff: at("03", 17), stadiumId: null },
  { id: 88, phase: "R32", kickoff: at("03", 21), stadiumId: null },
  // Round of 16 — July 4 … 7
  { id: 89, phase: "R16", kickoff: at("04", 17), stadiumId: null },
  { id: 90, phase: "R16", kickoff: at("04", 21), stadiumId: null },
  { id: 91, phase: "R16", kickoff: at("05", 17), stadiumId: null },
  { id: 92, phase: "R16", kickoff: at("05", 21), stadiumId: null },
  { id: 93, phase: "R16", kickoff: at("06", 17), stadiumId: null },
  { id: 94, phase: "R16", kickoff: at("06", 21), stadiumId: null },
  { id: 95, phase: "R16", kickoff: at("07", 17), stadiumId: null },
  { id: 96, phase: "R16", kickoff: at("07", 21), stadiumId: null },
  // Quarter-finals — July 9 (Boston), 10 (LA), 11 (KC + Miami)
  { id: 97, phase: "QF", kickoff: at("09"), stadiumId: 9 },
  { id: 98, phase: "QF", kickoff: at("10"), stadiumId: 16 },
  { id: 99, phase: "QF", kickoff: at("11", 16), stadiumId: 6 },
  { id: 100, phase: "QF", kickoff: at("11", 20), stadiumId: 8 },
  // Semi-finals — July 14 (Dallas), 15 (Atlanta)
  { id: 101, phase: "SF", kickoff: at("14"), stadiumId: 4 },
  { id: 102, phase: "SF", kickoff: at("15"), stadiumId: 7 },
  // Bronze — July 18 (Miami)
  { id: 103, phase: "THIRD", kickoff: at("18"), stadiumId: 8 },
  // Final — July 19 (New York/New Jersey)
  { id: 104, phase: "FINAL", kickoff: at("19", 19), stadiumId: 11 },
];
