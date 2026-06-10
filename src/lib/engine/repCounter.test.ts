import { describe, expect, it } from "vitest";
import {
  angleDeg,
  createRepCounter,
  readElbowAngle,
  type LandmarkLike,
} from "./repCounter";

describe("angleDeg", () => {
  it("straight arm ≈ 180°", () => {
    expect(
      angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }),
    ).toBeCloseTo(180);
  });
  it("right angle = 90°", () => {
    expect(
      angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }),
    ).toBeCloseTo(90);
  });
  it("degenerate points fall back to 180 (no false DOWN)", () => {
    expect(angleDeg({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(180);
  });
});

function pose(leftAngle: number, rightVis: number, leftVis = 0.9): LandmarkLike[] {
  // Build a synthetic pose where the left elbow sits at the requested angle.
  const lm: LandmarkLike[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    visibility: 0,
  }));
  const rad = (leftAngle * Math.PI) / 180;
  lm[11] = { x: -1, y: 0, visibility: leftVis }; // left shoulder
  lm[13] = { x: 0, y: 0, visibility: leftVis }; // left elbow
  lm[15] = { x: -Math.cos(rad), y: Math.sin(rad), visibility: leftVis }; // left wrist
  lm[12] = { x: 1, y: 0, visibility: rightVis };
  lm[14] = { x: 2, y: 0, visibility: rightVis };
  lm[16] = { x: 3, y: 0, visibility: rightVis }; // straight right arm (180°)
  return lm;
}

describe("readElbowAngle", () => {
  it("uses the only visible arm", () => {
    const r = readElbowAngle(pose(90, 0.1));
    expect(r.arms).toEqual(["left"]);
    expect(r.angle).toBeCloseTo(90, 0);
  });
  it("averages both arms when both are visible", () => {
    const r = readElbowAngle(pose(90, 0.9));
    expect(r.arms).toEqual(["left", "right"]);
    expect(r.angle).toBeCloseTo((90 + 180) / 2, 0);
  });
  it("returns null when nothing is visible enough", () => {
    const r = readElbowAngle(pose(90, 0.1, 0.1));
    expect(r.angle).toBeNull();
    expect(r.confidence).toBe(0);
  });
});

describe("createRepCounter", () => {
  const T = { upAngle: 160, downAngle: 95, minRepMs: 400 };

  it("counts a full down-up cycle once", () => {
    const c = createRepCounter(T);
    c.feed(170, 0);
    c.feed(90, 100); // DOWN
    const r = c.feed(170, 600); // back UP
    expect(r.counted).toBe(true);
    expect(c.reps).toBe(1);
  });

  it("hysteresis: mid-range wobble between 95° and 160° never counts", () => {
    const c = createRepCounter(T);
    for (let i = 0; i < 50; i++) {
      c.feed(120 + (i % 2) * 30, i * 33); // oscillate 120↔150
    }
    expect(c.reps).toBe(0);
  });

  it("requires going below downAngle before an up counts", () => {
    const c = createRepCounter(T);
    c.feed(100, 0); // not below 95 — still UP
    c.feed(170, 500);
    expect(c.reps).toBe(0);
  });

  it("debounce: a too-fast second rep is ignored", () => {
    const c = createRepCounter(T);
    c.feed(90, 0);
    expect(c.feed(170, 450).counted).toBe(true);
    c.feed(90, 500);
    expect(c.feed(170, 700).counted).toBe(false); // only 250ms later
    expect(c.reps).toBe(1);
    // but the machine stays in sync and counts the next honest rep
    c.feed(90, 1000);
    expect(c.feed(170, 1400).counted).toBe(true);
    expect(c.reps).toBe(2);
  });

  it("reset() zeroes everything", () => {
    const c = createRepCounter(T);
    c.feed(90, 0);
    c.feed(170, 500);
    c.reset();
    expect(c.reps).toBe(0);
    expect(c.phase).toBe("UP");
  });

  it("thresholds are swappable mid-set (calibration)", () => {
    const c = createRepCounter(T);
    c.setThresholds({ upAngle: 150, downAngle: 105, minRepMs: 0 });
    c.feed(100, 0); // below 105 → DOWN
    expect(c.feed(155, 100).counted).toBe(true);
  });
});
