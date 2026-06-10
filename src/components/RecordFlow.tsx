"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Minus, Plus, Square } from "lucide-react";
import { usePushupCounter } from "@/hooks/usePushupCounter";
import { SENSITIVITY_PRESETS } from "@/lib/engine/repCounter";
import { submitPushupSet } from "@/actions/pushups";

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
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-10 sm:px-6">
        <div className="py-6">
          <Link
            href={`/t/${tournamentId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Natrag na ligu
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            Snimi sklekove
          </h1>
        </div>

        <div className="card p-5 text-sm leading-relaxed text-muted">
          <p className="font-medium text-ink">Prije početka:</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              Nasloni mobitel da te vidi <strong className="text-ink">sa strane</strong>,
              cijelo tijelo u kadru.
            </li>
            <li>Kamera broji ponavljanja preko kuta lakta — dolje ispod 95°, pa natrag gore.</li>
            <li>Na kraju potvrđuješ broj; snimka ostaje ekipi na uvid.</li>
          </ol>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Kamera</label>
            <select
              value={counter.facingMode}
              onChange={(e) =>
                counter.setFacingMode(e.target.value as "user" | "environment")
              }
              className="input"
            >
              <option value="user">Prednja</option>
              <option value="environment">Stražnja</option>
            </select>
          </div>
          <div>
            <label className="label">Strogoća brojanja</label>
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                counter.setThresholds(SENSITIVITY_PRESETS[e.target.value]);
              }}
              className="input"
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
          <p className="mb-3 text-center text-sm text-muted">
            Trenutni dug:{" "}
            <span className="font-semibold tabular-nums text-danger">{outstanding}</span>{" "}
            — svaki sklek skida 1
          </p>
          <button onClick={handleStart} className="btn btn-primary w-full py-4 text-lg">
            <Camera className="size-5" />
            Pokreni kameru
          </button>
        </div>
      </div>
    );
  }

  /* ── LIVE (camera UI stays dark by design) ─────────────────────────── */
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

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            {counter.status === "loading" && "Pokrećem kameru…"}
            {counter.status === "running" &&
              (counter.tracking ? (
                <span className="text-emerald-300">● Pratim te</span>
              ) : (
                <span className="live-dot text-red-300">Ne vidim te — namjesti uređaj</span>
              ))}
            {counter.status === "error" && <span className="text-red-300">Greška</span>}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/70 backdrop-blur">
            <span className="live-dot size-2 rounded-full bg-red-500" />
            snima se
          </span>
        </div>

        {counter.status === "error" && (
          <div className="absolute inset-x-5 top-1/3 rounded-xl bg-black/85 p-5 text-center backdrop-blur">
            <p className="text-sm text-white">{counter.error}</p>
            <button
              onClick={() => counter.start()}
              className="btn btn-primary mt-3"
            >
              Pokušaj ponovno
            </button>
            <Link
              href={`/t/${tournamentId}`}
              className="mt-3 block text-sm text-white/60 underline"
            >
              Odustani
            </Link>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black via-black/70 to-transparent px-5 pb-8 pt-20">
          <div className="text-center">
            <div
              className={`text-[6.5rem] font-semibold leading-none tabular-nums tracking-tight ${
                counter.phase === "DOWN" ? "text-emerald-300" : "text-white"
              }`}
            >
              {counter.reps}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-[0.25em] text-white/60">
              {counter.phase === "DOWN" ? "dolje — guraj" : "spreman"}
            </div>
          </div>
          <button
            onClick={handleStop}
            disabled={counter.status === "loading"}
            className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-white py-4 text-lg font-semibold text-black disabled:opacity-50"
          >
            <Square className="size-5 fill-red-600 text-red-600" />
            Završi set
          </button>
        </div>
      </div>
    );
  }

  /* ── CONFIRM ───────────────────────────────────────────────────────── */
  if (stage === "confirm" || stage === "saving") {
    const saving = stage === "saving";
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-10 sm:px-6">
        <div className="py-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Potvrdi set
          </h1>
          <p className="mt-1 text-sm text-muted">
            Kamera je izbrojala{" "}
            <span className="font-semibold text-ink">{counter.reps}</span>{" "}
            (pouzdanost {Math.round(counter.confidence * 100)}%). Ti imaš zadnju
            riječ.
          </p>
        </div>

        <div className="card flex items-center justify-center gap-6 p-6">
          <button
            onClick={() => setConfirmedReps((r) => Math.max(0, r - 1))}
            disabled={saving}
            className="btn btn-outline size-14 rounded-full p-0"
            aria-label="Smanji"
          >
            <Minus className="size-5" />
          </button>
          <div className="text-center">
            <div className="text-7xl font-semibold tabular-nums tracking-tight text-ink">
              {confirmedReps}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted">
              sklekova
            </div>
          </div>
          <button
            onClick={() => setConfirmedReps((r) => Math.min(1000, r + 1))}
            disabled={saving}
            className="btn btn-outline size-14 rounded-full p-0"
            aria-label="Povećaj"
          >
            <Plus className="size-5" />
          </button>
        </div>

        <div className="mt-4">
          {clipUrl ? (
            <video
              src={clipUrl}
              controls
              playsInline
              className="max-h-64 w-full rounded-xl border border-line bg-black object-contain"
            />
          ) : (
            <p className="card p-4 text-center text-sm text-muted">
              Snimka nije dostupna — set se sprema bez videa.
            </p>
          )}
        </div>

        {saveError && <p className="mt-3 text-sm text-danger">{saveError}</p>}

        <div className="mt-auto space-y-2 pt-6">
          {saving && uploadPct !== null && (
            <div className="h-2 overflow-hidden rounded-full border border-line bg-card">
              <div
                className="h-full bg-[var(--primary)] transition-all"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || confirmedReps < 1}
            className="btn btn-primary w-full py-3.5 text-base"
          >
            {saving
              ? uploadPct !== null
                ? `Šaljem snimku ${uploadPct}%`
                : "Spremam…"
              : `Plati ${confirmedReps} duga`}
          </button>
          <button
            onClick={() => {
              counter.reset();
              setStage("intro");
            }}
            disabled={saving}
            className="btn btn-ghost w-full"
          >
            Odbaci i ponovi
          </button>
        </div>
      </div>
    );
  }

  /* ── DONE ──────────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-4 text-center sm:px-6">
      <div className="text-6xl font-semibold tabular-nums tracking-tight text-primary">
        −{result?.paid ?? 0}
      </div>
      <p className="mt-2 text-muted">duga otplaćeno</p>
      {uploadFailed && (
        <p className="mt-2 text-xs text-muted">
          Snimka se nije uspjela poslati — set je svejedno upisan.
        </p>
      )}
      <div className="card mt-6 px-10 py-5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">
          preostali dug
        </div>
        <div
          className={`mt-1 text-5xl font-semibold tabular-nums tracking-tight ${
            (result?.outstanding ?? 0) > 0 ? "text-danger" : "text-primary"
          }`}
        >
          {result?.outstanding ?? 0}
        </div>
        {result && result.outstanding === 0 && (
          <span className="badge badge-green mt-2">sve plaćeno</span>
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
          className="btn btn-primary py-3"
        >
          Još jedan set
        </button>
        <Link href={`/t/${tournamentId}`} className="btn btn-outline py-3">
          Natrag na ligu
        </Link>
      </div>
    </div>
  );
}
