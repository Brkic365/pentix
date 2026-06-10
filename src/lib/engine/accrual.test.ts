import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, parsePentixConfig, type PentixConfig } from "@/lib/config";
import {
  computeGoalBase,
  eliminationAmount,
  goalSide,
  memberAccrualAmount,
  scorerMatchesFavorite,
  shootoutAmount,
  topThreeAmount,
  type GoalAccrualInput,
} from "./accrual";

const cfg: PentixConfig = DEFAULT_CONFIG;

function goal(overrides: Partial<GoalAccrualInput> = {}): GoalAccrualInput {
  return {
    phase: "GROUP",
    side: "MAIN",
    scorerName: "Kramarić",
    isPenalty: false,
    isOwnGoal: false,
    isLate: false,
    nthGoalBySamePlayer: 1,
    ...overrides,
  };
}

describe("goalSide", () => {
  const params = { mainCountryId: 46, homeTeamId: 45, awayTeamId: 46 };
  it("MAIN when main country scores", () => {
    expect(goalSide({ ...params, scoringTeamId: 46 })).toBe("MAIN");
  });
  it("AGAINST when opponent scores in a main-country match", () => {
    expect(goalSide({ ...params, scoringTeamId: 45 })).toBe("AGAINST");
  });
  it("NEUTRAL when main country is not playing", () => {
    expect(
      goalSide({ scoringTeamId: 1, mainCountryId: 46, homeTeamId: 1, awayTeamId: 2 }),
    ).toBe("NEUTRAL");
  });
});

describe("computeGoalBase — core formula", () => {
  it("main-team group goal: 5 × 1 × 3 = 15", () => {
    expect(computeGoalBase(cfg, goal()).base).toBe(15);
  });

  it("conceded group goal: 5 × 1 × 4 = 20", () => {
    expect(computeGoalBase(cfg, goal({ side: "AGAINST", scorerName: "Kane" })).base).toBe(20);
  });

  it("conceded QF goal: 5 × 2 × 4 = 40", () => {
    expect(
      computeGoalBase(cfg, goal({ side: "AGAINST", phase: "QF", scorerName: "Kane" })).base,
    ).toBe(40);
  });

  it("main-team FINAL goal: 5 × 5 × 3 = 75", () => {
    expect(computeGoalBase(cfg, goal({ phase: "FINAL" })).base).toBe(75);
  });

  it("neutral goal uses team multiplier 1: 5 × 1.5 × 1 = 7.5", () => {
    const r = computeGoalBase(cfg, goal({ side: "NEUTRAL", phase: "R16" }));
    expect(r.raw).toBe(7.5);
    expect(r.teamMult).toBe(1);
  });
});

describe("computeGoalBase — flat bonuses (not phase-multiplied)", () => {
  it("late goal adds flat +10 even in the FINAL", () => {
    const normal = computeGoalBase(cfg, goal({ phase: "FINAL" }));
    const late = computeGoalBase(cfg, goal({ phase: "FINAL", isLate: true }));
    expect(late.base - normal.base).toBe(10);
  });

  it("penalty goal subtracts 2", () => {
    expect(computeGoalBase(cfg, goal({ isPenalty: true })).base).toBe(13);
  });

  it("favorite player goal adds +20", () => {
    expect(computeGoalBase(cfg, goal({ scorerName: "Livaja" })).base).toBe(35);
  });

  it("favorite player matches full names and diacritics", () => {
    expect(computeGoalBase(cfg, goal({ scorerName: "Marko LĪVAJA" })).base).toBe(35);
  });

  it("bonuses stack: late + penalty + favorite", () => {
    const r = computeGoalBase(
      cfg,
      goal({ scorerName: "Livaja", isLate: true, isPenalty: true }),
    );
    // 15 + 20 + 10 − 2
    expect(r.base).toBe(43);
  });

  it("base is floored at 0 when negative bonuses dominate", () => {
    const harsh = parsePentixConfig({
      baseReps: 1,
      mainTeamGoalMultiplier: 1,
      flatBonuses: { penaltyGoal: -50 },
    });
    expect(computeGoalBase(harsh, goal({ isPenalty: true })).base).toBe(0);
  });
});

describe("computeGoalBase — hat-trick rule", () => {
  it("3rd goal by same player doubles the raw (not the flats)", () => {
    const r = computeGoalBase(cfg, goal({ nthGoalBySamePlayer: 3, isLate: true }));
    // raw 15×2 = 30, + late 10
    expect(r.raw).toBe(30);
    expect(r.base).toBe(40);
    expect(r.hatTrickApplied).toBe(true);
  });

  it("2nd and 4th goals do not double", () => {
    expect(computeGoalBase(cfg, goal({ nthGoalBySamePlayer: 2 })).base).toBe(15);
    expect(computeGoalBase(cfg, goal({ nthGoalBySamePlayer: 4 })).base).toBe(15);
  });

  it("can be disabled via config", () => {
    const noHt = parsePentixConfig({ flatBonuses: { hatTrickThirdGoalDoubles: false } });
    expect(computeGoalBase(noHt, goal({ nthGoalBySamePlayer: 3 })).base).toBe(15);
  });
});

describe("computeGoalBase — own goals", () => {
  it("own goal still generates debt for the credited side", () => {
    expect(computeGoalBase(cfg, goal({ isOwnGoal: true, scorerName: "Gvardiol" })).base).toBe(15);
  });

  it("own goal never triggers favorite-player bonus", () => {
    expect(computeGoalBase(cfg, goal({ isOwnGoal: true, scorerName: "Livaja" })).base).toBe(15);
  });

  it("own goal never counts toward a hat-trick", () => {
    const r = computeGoalBase(cfg, goal({ isOwnGoal: true, nthGoalBySamePlayer: 3 }));
    expect(r.hatTrickApplied).toBe(false);
    expect(r.base).toBe(15);
  });
});

describe("scorerMatchesFavorite", () => {
  it("is case- and diacritic-insensitive containment", () => {
    expect(scorerMatchesFavorite("Marko Livaja", "livaja")).toBe(true);
    expect(scorerMatchesFavorite("PERIŠIĆ", "perisic")).toBe(true);
    expect(scorerMatchesFavorite("Đalović", "dalovic")).toBe(true);
    expect(scorerMatchesFavorite("Modrić", "Livaja")).toBe(false);
  });
  it("empty favorite never matches", () => {
    expect(scorerMatchesFavorite("Livaja", "")).toBe(false);
  });
});

describe("memberAccrualAmount — handicap scales accrual only", () => {
  it("scales and rounds half-up to whole pushups", () => {
    expect(memberAccrualAmount(15, 1)).toBe(15);
    expect(memberAccrualAmount(15, 1.2)).toBe(18);
    expect(memberAccrualAmount(15, 1.5)).toBe(23); // 22.5 → 23
    expect(memberAccrualAmount(15, 2)).toBe(30);
  });
  it("fractional G from phase multipliers rounds per member", () => {
    // neutral R32 goal: 5 × 1.25 × 1 = 6.25
    const g = computeGoalBase(cfg, goal({ side: "NEUTRAL", phase: "R32" }));
    expect(memberAccrualAmount(g.base, 1)).toBe(6);
  });
});

describe("special accruals", () => {
  it("elimination penalty scales with handicap", () => {
    expect(eliminationAmount(cfg, 1)).toBe(100);
    expect(eliminationAmount(cfg, 1.5)).toBe(150);
  });

  it("top-three bonus by placement (1st place = 0 by default)", () => {
    expect(topThreeAmount(cfg, 1, 1)).toBe(0);
    expect(topThreeAmount(cfg, 2, 1)).toBe(50);
    expect(topThreeAmount(cfg, 3, 1)).toBe(150);
    expect(topThreeAmount(cfg, 4, 1)).toBe(0);
    expect(topThreeAmount(cfg, 3, 1.2)).toBe(180);
  });

  it("shootout: everyoneReps + perMissBonus × misses", () => {
    expect(shootoutAmount(cfg, 0, 1)).toBe(30);
    expect(shootoutAmount(cfg, 3, 1)).toBe(45);
    expect(shootoutAmount(cfg, 2, 1.5)).toBe(60);
  });

  it("shootout disabled yields 0", () => {
    const off = parsePentixConfig({ shootout: { enabled: false } });
    expect(shootoutAmount(off, 4, 1)).toBe(0);
  });
});

describe("parsePentixConfig", () => {
  it("returns defaults for null/garbage", () => {
    expect(parsePentixConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(parsePentixConfig("nonsense")).toEqual(DEFAULT_CONFIG);
  });
  it("merges partial overrides over defaults", () => {
    const c = parsePentixConfig({ baseReps: 10, interest: { dailyRate: 0.1 } });
    expect(c.baseReps).toBe(10);
    expect(c.interest.dailyRate).toBe(0.1);
    expect(c.interest.capMultiplier).toBe(3);
    expect(c.phaseMultipliers.FINAL).toBe(5);
  });
  it("drops unknown keys", () => {
    const c = parsePentixConfig({ hacks: true });
    expect("hacks" in c).toBe(false);
  });
});
