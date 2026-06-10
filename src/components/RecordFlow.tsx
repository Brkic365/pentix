"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePushupCounter } from "@/hooks/usePushupCounter";
import { SENSITIVITY_PRESETS } from "@/lib/engine/repCounter";
import { submitPushupSet } from "@/actions/pushups";
import { sklekova } from "@/lib/format";

type Stage = "intro" | "live" | "confirm" | "saving" | "done";

async function uploadClip(
  tournamentId: string,
  clip: Blob,
  mimeType: string,
  onProgress: (pct: number) => void,
): Promise<string | null> {
  try {
    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId,
        contentType: mimeType.split(";")[0] || "video/webm",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      disabled?: boolean;
      uploadUrl?: string;
      publicUrl?: string;
      contentType?: string;
    };
    if (data.disabled || !data.uploadUrl || !data.publicUrl) return null;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", data.uploadUrl!);
      xhr.setRequestHeader("Content-Type", data.contentType!);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`${xhr.status}`));
      xhr.onerror = () => reject(new Error("network"));
      xhr.send(clip);
    });
    return data.publicUrl;
  } catch {
    return null; // clip is nice-to-have; the reps are what matters
  }
}

export function RecordFlow({
  tournamentId,
  outstanding,
}: {
  tournamentId: string;
  outstanding: number;
}) {
  const router = useRouter();
  const counter = usePushupCounter();
  const [stage, setStage] = useState<Stage>("intro");
  const [confirmedReps, setConfirmedReps] = useState(0);
  const [preset, setPreset] = useState("normalno");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [result, setResult] = useState<{ outstanding: number; paid: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const clipUrl = useMemo(
    () => (counter.clip ? URL.createObjectURL(counter.clip) : null),
    [counter.clip],
  );
  useEffect(() => {
    return () => {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
    };
  }, [clipUrl]);

  const mirrored = counter.facingMode === "user";

  async function handleStart() {
    setStage("live");
    await counter.start();
  }

  async function handleStop() {
    await counter.stop();
    setConfirmedReps(counter.reps);
    setStage("confirm");
  }

  async function handleSave() {
    setStage("saving");
    setSaveError(null);
    let videoUrl: string | null = null;
    if (counter.clip) {
      setUploadPct(0);
      videoUrl = await uploadClip(
        tournamentId,
        counter.clip,
        counter.clipMimeType,
        setUploadPct,
      );
      setUploadFailed(videoUrl === null);
      setUploadPct(null);
    }
    try {
      const r = await submitPushupSet(tournamentId, {
        reps: confirmedReps,
        cvReps: counter.reps,
        cvConfidence: counter.confidence,
        videoUrl,
      });
      setResult(r);
      setStage("done");
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Spremanje nije uspjelo.");
      setStage("confirm");
    }
  }

  /* ── INTRO ─────────────────────────────────────────────────────────── */
  if (stage === "intro") {
    return (
      <div className="flex min-h-dvh flex-col px-5 pb-10">
        <header className="flex items-center gap-3 py-4">
          <Link href={`/t/${tournamentId}`} className="text-muted">
            ←
          </Link>
          <h1 className="font-display text-2xl">SNIMI SKLEKOVE</h1>
        </header>

        <div className="rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-muted">
          <p className="font-semibold text-ink">Kako se plaća dug:</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Nasloni mobitel da te vidi <span className="text-ink">sa strane</span>, cijelo tijelo u kadru.</li>
            <li>Kamera broji svaki sklek — lakat ispod 95°, pa natrag gore.</li>
            <li>Na kraju potvrdiš broj. Snimka ide ekipi na uvid. 👀</li>
          </ol>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted">
              Kamera
            </label>
            <select
              value={counter.facingMode}
              onChange={(e) =>
                counter.setFacingMode(e.target.value as "user" | "environment")
              }
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5"
            >
              <option value="user">Prednja</option>
              <option value="environment">Stražnja</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted">
              Strogoća brojanja
            </label>
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                counter.setThresholds(SENSITIVITY_PRESETS[e.target.value]);
              }}
              className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5"
            >
              {Object.keys(SENSITIVITY_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-auto pt-8">
          <div className="mb-3 text-center text-sm text-muted">
            Dug: <span className="font-display text-lg text-debt">{outstanding}</span>{" "}
            — svaki sklek skida 1
          </div>
          <button
            onClick={handleStart}
            className="record-pulse w-full rounded-3xl bg-volt py-6 font-display text-3xl text-pitch"
          >
            ● KRENI
          </button>
        </div>
      </div>
    );
  }

  /* ── LIVE ──────────────────────────────────────────────────────────── */
  if (stage === "live") {
    return (
      <div className="relative min-h-dvh bg-black">
        <div className="absolute inset-0 overflow-hidden">
          <video
            ref={counter.videoRef}
            className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
            playsInline
            muted
          />
          <canvas
            ref={counter.canvasRef}
            className={`absolute inset-0 h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
          />
        </div>

        {/* status overlay */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink backdrop-blur">
            {counter.status === "loading" && "⏳ palim kameru…"}
            {counter.status === "running" &&
              (counter.tracking ? (
                <span className="text-volt">● pratim te</span>
              ) : (
                <span className="debt-blink text-debt">ne vidim te — namjesti mobitel</span>
              ))}
            {counter.status === "error" && <span className="text-debt">greška</span>}
          </span>
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-muted backdrop-blur">
            REC ●
          </span>
        </div>

        {counter.status === "error" && (
          <div className="absolute inset-x-5 top-1/3 rounded-2xl border border-debt/50 bg-black/80 p-5 text-center backdrop-blur">
            <p className="text-sm text-ink">{counter.error}</p>
            <button
              onClick={() => counter.start()}
              className="mt-3 rounded-xl bg-volt px-5 py-2.5 font-bold text-pitch"
            >
              Pokušaj opet
            </button>
            <Link
              href={`/t/${tournamentId}`}
              className="mt-2 block text-sm text-muted underline"
            >
              odustani
            </Link>
          </div>
        )}

        {/* giant counter */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black via-black/70 to-transparent px-5 pb-8 pt-20">
          <div className="text-center">
            <div
              className={`font-display text-[7rem] leading-none ${
                counter.phase === "DOWN" ? "text-volt" : "text-ink"
              }`}
            >
              {counter.reps}
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted">
              {counter.phase === "DOWN" ? "▼ dolje — guraj!" : "▲ spreman"}
            </div>
          </div>
          <button
            onClick={handleStop}
            disabled={counter.status === "loading"}
            className="w-full max-w-xs rounded-2xl bg-debt py-4 font-display text-2xl text-ink disabled:opacity-50"
          >
            ■ GOTOV SAM
          </button>
        </div>
      </div>
    );
  }

  /* ── CONFIRM ───────────────────────────────────────────────────────── */
  if (stage === "confirm" || stage === "saving") {
    const saving = stage === "saving";
    return (
      <div className="flex min-h-dvh flex-col px-5 pb-10">
        <header className="py-4">
          <h1 className="font-display text-2xl">POTVRDI SET</h1>
          <p className="text-sm text-muted">
            Kamera je izbrojala{" "}
            <span className="font-bold text-ink">{counter.reps}</span> (pouzdanost{" "}
            {Math.round(counter.confidence * 100)}%). Ti imaš zadnju riječ.
          </p>
        </header>

        <div className="flex items-center justify-center gap-6 py-6">
          <button
            onClick={() => setConfirmedReps((r) => Math.max(0, r - 1))}
            disabled={saving}
            className="size-16 rounded-full border border-line bg-surface font-display text-3xl disabled:opacity-40"
            aria-label="Manje"
          >
            −
          </button>
          <div className="text-center">
            <div className="font-display text-8xl leading-none tabular-nums">
              {confirmedReps}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.25em] text-muted">
              sklekova
            </div>
          </div>
          <button
            onClick={() => setConfirmedReps((r) => Math.min(1000, r + 1))}
            disabled={saving}
            className="size-16 rounded-full border border-line bg-surface font-display text-3xl disabled:opacity-40"
            aria-label="Više"
          >
            +
          </button>
        </div>

        {clipUrl ? (
          <video
            src={clipUrl}
            controls
            playsInline
            className={`max-h-64 w-full rounded-2xl border border-line bg-black object-contain`}
          />
        ) : (
          <p className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-muted">
            Snimka nije dostupna — set ide bez videa.
          </p>
        )}

        {saveError && <p className="mt-3 text-sm text-debt">{saveError}</p>}

        <div className="mt-auto space-y-2 pt-6">
          {saving && uploadPct !== null && (
            <div className="overflow-hidden rounded-full border border-line bg-surface">
              <div
                className="h-2 bg-volt transition-all"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || confirmedReps < 1}
            className="w-full rounded-2xl bg-volt py-4 font-display text-2xl text-pitch disabled:opacity-50"
          >
            {saving
              ? uploadPct !== null
                ? `ŠALJEM SNIMKU ${uploadPct}%`
                : "SPREMAM…"
              : `PLATI ${confirmedReps} DUGA`}
          </button>
          <button
            onClick={() => {
              counter.reset();
              setStage("intro");
            }}
            disabled={saving}
            className="w-full rounded-2xl border border-line py-3 text-sm text-muted disabled:opacity-50"
          >
            Odbaci i ponovi
          </button>
        </div>
      </div>
    );
  }

  /* ── DONE ──────────────────────────────────────────────────────────── */
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div className="font-display text-7xl text-volt">−{result?.paid ?? 0}</div>
      <p className="mt-2 text-muted">duga otplaćeno. Kamatari plaču. 🤝</p>
      {uploadFailed && (
        <p className="mt-2 text-xs text-muted">
          (snimka se nije uspjela poslati — set je svejedno upisan)
        </p>
      )}
      <div className="mt-6 rounded-2xl border border-line bg-surface px-8 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted">
          preostali dug
        </div>
        <div
          className={`font-display text-5xl ${
            (result?.outstanding ?? 0) > 0 ? "text-debt" : "text-volt"
          }`}
        >
          {result?.outstanding ?? 0}
        </div>
        {result && result.outstanding === 0 && (
          <div className="mt-1 text-sm text-volt">ČIST SI! ⚡</div>
        )}
      </div>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <button
          onClick={() => {
            counter.reset();
            setConfirmedReps(0);
            setResult(null);
            setStage("intro");
          }}
          className="rounded-2xl bg-volt py-3.5 font-display text-xl text-pitch"
        >
          JOŠ JEDAN SET
        </button>
        <Link
          href={`/t/${tournamentId}`}
          className="rounded-2xl border border-line py-3.5 font-semibold text-ink"
        >
          Natrag na ligu
        </Link>
      </div>
      {result && result.outstanding > 0 && (
        <p className="mt-6 text-xs text-muted">
          još {sklekova(result.outstanding)} do mira. Kamata ne čeka.
        </p>
      )}
    </div>
  );
}
