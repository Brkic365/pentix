"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Kopiraj" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable (http, old browser) — show the text instead
          window.prompt("Kopiraj ručno:", text);
        }
      }}
      className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-pitch"
    >
      {copied ? "Kopirano ✓" : label}
    </button>
  );
}
