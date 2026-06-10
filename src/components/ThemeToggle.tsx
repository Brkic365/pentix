"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "pentix-theme";

/** Light/dark switch — pairs with the no-flash script in layout.tsx. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // private mode — theme just won't persist
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Svijetla tema" : "Tamna tema"}
      aria-label={dark ? "Prebaci na svijetlu temu" : "Prebaci na tamnu temu"}
      className="btn btn-ghost px-2.5"
    >
      {dark === null ? (
        <Sun className="size-4 opacity-0" />
      ) : dark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
