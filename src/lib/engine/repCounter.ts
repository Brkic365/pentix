/**
 * Pure pushup-rep detection math — no MediaPipe, no DOM, fully unit-testable.
 * The camera hook feeds elbow angles in; this decides what counts as a rep.
 */

export interface LandmarkLike {
  x: number;
  y: number;
  visibility?: number;
}

/** MediaPipe pose landmark indices for the arms. */
export const ARM_LANDMARKS = {
  left: { shoulder: 11, elbow: 13, wrist: 15 },
  right: { shoulder: 12, elbow: 14, wrist: 16 },
} as const;

/** Inner angle at point b (degrees, 0–180), in image-plane 2D. */
export function angleDeg(a: LandmarkLike, b: LandmarkLike, c: LandmarkLike): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag === 0) return 180;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export interface ArmReading {
  /** averaged elbow angle of the arm(s) we trust, or null when neither is visible enough */
  angle: number | null;
  /** mean visibility of the joints used (0..1) */
  confidence: number;
  /** which arms contributed */
  arms: ("left" | "right")[];
}

const MIN_ARM_VISIBILITY = 0.5;

/**
 * Reads the elbow angle from a full pose. Uses the more-visible arm, or the
 * average of both when both are clearly visible.
 */
export function readElbowAngle(landmarks: LandmarkLike[]): ArmReading {
  const sides = ["left", "right"] as const;
  const perArm = sides.map((side) => {
    const idx = ARM_LANDMARKS[side];
    const s = landmarks[idx.shoulder];
    const e = landmarks[idx.elbow];
    const w = landmarks[idx.wrist];
    if (!s || !e || !w) return { side, vis: 0, angle: null as number | null };
    const vis =
      ((s.visibility ?? 0) + (e.visibility ?? 0) + (w.visibility ?? 0)) / 3;
    return { side, vis, angle: angleDeg(s, e, w) };
  });

  const usable = perArm.filter((a) => a.angle !== null && a.vis >= MIN_ARM_VISIBILITY);
  if (usable.length === 0) return { angle: null, confidence: 0, arms: [] };
  if (usable.length === 2) {
    return {
      angle: (usable[0].angle! + usable[1].angle!) / 2,
      confidence: (usable[0].vis + usable[1].vis) / 2,
      arms: ["left", "right"],
    };
  }
  const best = usable[0];
  return { angle: best.angle!, confidence: best.vis, arms: [best.side] };
}

export interface RepThresholds {
  /** arm counts as extended again above this angle (rep completes) */
  upAngle: number;
  /** arm counts as bent below this angle (rep is "down") */
  downAngle: number;
  /** minimum ms between two counted reps — kills double counts from jitter */
  minRepMs: number;
}

export const DEFAULT_THRESHOLDS: RepThresholds = {
  upAngle: 160,
  downAngle: 95,
  minRepMs: 400,
};

/** Preset sensitivities for the calibration UI. */
export const SENSITIVITY_PRESETS: Record<string, RepThresholds> = {
  strogo: { upAngle: 165, downAngle: 85, minRepMs: 500 },
  normalno: DEFAULT_THRESHOLDS,
  opusteno: { upAngle: 150, downAngle: 105, minRepMs: 350 },
};

export interface RepFeedResult {
  counted: boolean;
  phase: "UP" | "DOWN";
  reps: number;
}

/**
 * Hysteresis state machine: starts UP, flips DOWN below downAngle, and counts
 * one rep on the return above upAngle — at most once per minRepMs.
 */
export function createRepCounter(thresholds: RepThresholds = DEFAULT_THRESHOLDS) {
  let phase: "UP" | "DOWN" = "UP";
  let reps = 0;
  let lastRepAt = -Infinity;
  let t = thresholds;

  return {
    get reps() {
      return reps;
    },
    get phase() {
      return phase;
    },
    setThresholds(next: RepThresholds) {
      t = next;
    },
    reset() {
      phase = "UP";
      reps = 0;
      lastRepAt = -Infinity;
    },
    feed(angle: number, nowMs: number): RepFeedResult {
      let counted = false;
      if (phase === "UP" && angle < t.downAngle) {
        phase = "DOWN";
      } else if (phase === "DOWN" && angle > t.upAngle) {
        phase = "UP";
        if (nowMs - lastRepAt >= t.minRepMs) {
          reps += 1;
          lastRepAt = nowMs;
          counted = true;
        }
      }
      return { counted, phase, reps };
    },
  };
}

export type RepCounter = ReturnType<typeof createRepCounter>;
