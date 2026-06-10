"use client";

import { useEffect, useRef, useState } from "react";
import type { PentixConfig } from "@/lib/config";
import {
  configToFieldValues,
  FORMULA_PRESETS,
  matchPresetKey,
} from "@/lib/presets";

/**
 * Preset cards that fill the surrounding <form>'s ConfigFields inputs.
 * Editing any field by hand flips the state to "Prilagođeno".
 */
export function FormulaPresetPicker({
  initialConfig,
}: {
  initialConfig: PentixConfig;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const applying = useRef(false);
  const [selected, setSelected] = useState<string | null>(() =>
    matchPresetKey(initialConfig),
  );

  // Any manual edit to the formula fields ⇒ custom
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onInput = () => {
      if (!applying.current) setSelected(null);
    };
    form.addEventListener("input", onInput);
    return () => form.removeEventListener("input", onInput);
  }, []);

  function applyPreset(key: string) {
    const preset = FORMULA_PRESETS.find((p) => p.key === key);
    const form = rootRef.current?.closest("form");
    if (!preset || !form) return;

    applying.current = true;
    const values = configToFieldValues(preset.config);
    for (const [name, value] of Object.entries(values)) {
      const el = form.elements.namedItem(name);
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement))
        continue;
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        el.checked = value === true;
      } else {
        el.value = String(value);
      }
    }
    applying.current = false;
    setSelected(key);
  }

  return (
    <div ref={rootRef}>
      <div className="grid gap-2 sm:grid-cols-3">
        {FORMULA_PRESETS.map((p) => {
          const active = selected === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              aria-pressed={active}
              className={`rounded-lg border p-3.5 text-left transition-colors ${
                active
                  ? "border-primary-soft-border bg-primary-soft"
                  : "border-line bg-card hover:border-line-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-semibold ${
                    active ? "text-primary" : "text-ink"
                  }`}
                >
                  {p.name}
                </span>
                {p.key === "klasika" && (
                  <span className="badge badge-gray">preporučeno</span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{p.tagline}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.highlights.map((h) => (
                  <span
                    key={h}
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      active
                        ? "bg-[var(--card)] text-primary"
                        : "bg-card-subtle text-muted"
                    }`}
                  >
                    {h}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        {selected === null
          ? "Prilagođena formula — vrijednosti ispod su ručno postavljene."
          : "Sve vrijednosti ispod možeš i dalje ručno doraditi."}
      </p>
    </div>
  );
}
