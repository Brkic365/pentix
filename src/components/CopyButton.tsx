"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

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
      className="btn btn-outline"
    >
      {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
      {copied ? "Kopirano" : label}
    </button>
  );
}
