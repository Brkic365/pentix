"use client";

/**
 * Self-contained pushup counter on @mediapipe/tasks-vision PoseLandmarker
 * (WASM, VIDEO mode). The detection *math* lives in lib/engine/repCounter —
 * this hook owns camera, model, recording and the canvas overlay, so the
 * whole detection backend stays swappable behind one interface.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  ARM_LANDMARKS,
  createRepCounter,
  DEFAULT_THRESHOLDS,
  readElbowAngle,
  type RepThresholds,
} from "@/lib/engine/repCounter";

// Pinned to the installed package version; both are swappable (self-host to
// /public if the CDN ever becomes a problem).
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

export type CounterStatus =
  | "idle"
  | "loading"
  | "running"
  | "stopped"
  | "error";

export interface UsePushupCounterResult {
  status: CounterStatus;
  error: string | null;
  reps: number;
  phase: "UP" | "DOWN";
  /** true while the pose is currently being picked up */
  tracking: boolean;
  /** mean visibility of counted joints so far (0..1) */
  confidence: number;
  /** recorded clip — available once status === "stopped" */
  clip: Blob | null;
  clipMimeType: string;
  thresholds: RepThresholds;
  setThresholds: (t: RepThresholds) => void;
  facingMode: "user" | "environment";
  setFacingMode: (f: "user" | "environment") => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
}

export function usePushupCounter(): UsePushupCounterResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const counterRef = useRef(createRepCounter());
  const confSumRef = useRef(0);
  const confFramesRef = useRef(0);
  const runningRef = useRef(false);

  const [status, setStatus] = useState<CounterStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState<"UP" | "DOWN">("UP");
  const [tracking, setTracking] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [clip, setClip] = useState<Blob | null>(null);
  const [clipMimeType] = useState(pickMimeType);
  const [thresholds, setThresholdsState] = useState<RepThresholds>(DEFAULT_THRESHOLDS);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const setThresholds = useCallback((t: RepThresholds) => {
    setThresholdsState(t);
    counterRef.current.setThresholds(t);
  }, []);

  const draw = useCallback(
    (landmarks: NormalizedLandmark[] | null, activeArms: ("left" | "right")[]) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!landmarks) return;

      const px = (i: number) => ({
        x: landmarks[i].x * canvas.width,
        y: landmarks[i].y * canvas.height,
      });

      // full skeleton, faint
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(242,245,249,0.35)";
      for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
        const a = landmarks[start];
        const b = landmarks[end];
        if (!a || !b || (a.visibility ?? 0) < 0.4 || (b.visibility ?? 0) < 0.4) continue;
        const pa = px(start);
        const pb = px(end);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // the arm(s) we count, loud
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#c8f31d";
      ctx.fillStyle = "#c8f31d";
      for (const side of activeArms) {
        const { shoulder, elbow, wrist } = ARM_LANDMARKS[side];
        const s = px(shoulder);
        const e = px(elbow);
        const w = px(wrist);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.lineTo(w.x, w.y);
        ctx.stroke();
        for (const p of [s, e, w]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    [],
  );

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(loop);

    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) return;
    if (video.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = video.currentTime;

    const result = landmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0] ?? null;

    if (!landmarks) {
      setTracking(false);
      draw(null, []);
      return;
    }

    const reading = readElbowAngle(landmarks);
    setTracking(reading.angle !== null);
    draw(landmarks, reading.arms);
    if (reading.angle === null) return;

    confSumRef.current += reading.confidence;
    confFramesRef.current += 1;
    setConfidence(confSumRef.current / confFramesRef.current);

    const fed = counterRef.current.feed(reading.angle, performance.now());
    setPhase(fed.phase);
    if (fed.counted) {
      setReps(fed.reps);
      if (navigator.vibrate) navigator.vibrate(40);
    }
  }, [draw]);

  const cleanup = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setClip(null);
    chunksRef.current = [];
    counterRef.current.reset();
    counterRef.current.setThresholds(thresholds);
    confSumRef.current = 0;
    confFramesRef.current = 0;
    setReps(0);
    setPhase("UP");
    setConfidence(0);

    try {
      // 1. model
      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        try {
          landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        } catch {
          // some mobile GPUs reject the WebGL delegate — retry on CPU
          landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        }
      }

      // 2. camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element missing");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      // 3. clip recorder (best effort — counting works without it)
      try {
        const recorder = new MediaRecorder(
          stream,
          clipMimeType ? { mimeType: clipMimeType, videoBitsPerSecond: 1_500_000 } : undefined,
        );
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(1000);
        recorderRef.current = recorder;
      } catch {
        recorderRef.current = null;
      }

      // 4. go
      lastVideoTimeRef.current = -1;
      runningRef.current = true;
      setStatus("running");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      cleanup();
      setStatus("error");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Nema pristupa kameri. Dozvoli kameru u postavkama preglednika."
          : "Ne mogu pokrenuti brojač. Provjeri kameru i pokušaj ponovno.",
      );
    }
  }, [cleanup, clipMimeType, facingMode, loop, thresholds]);

  const stop = useCallback(async () => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);

    const recorder = recorderRef.current;
    const finished: Promise<void> = recorder && recorder.state !== "inactive"
      ? new Promise((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        })
      : Promise.resolve();
    await finished;
    recorderRef.current = null;

    if (chunksRef.current.length > 0) {
      setClip(new Blob(chunksRef.current, { type: clipMimeType || "video/webm" }));
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("stopped");
  }, [clipMimeType]);

  const reset = useCallback(() => {
    cleanup();
    chunksRef.current = [];
    setClip(null);
    setReps(0);
    setPhase("UP");
    setConfidence(0);
    setTracking(false);
    setStatus("idle");
    setError(null);
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    error,
    reps,
    phase,
    tracking,
    confidence,
    clip,
    clipMimeType,
    thresholds,
    setThresholds,
    facingMode,
    setFacingMode,
    videoRef,
    canvasRef,
    start,
    stop,
    reset,
  };
}
