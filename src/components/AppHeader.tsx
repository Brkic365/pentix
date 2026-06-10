import Link from "next/link";
import { PentixLogo } from "@/components/PentixLogo";
import { AuthButton } from "@/components/AuthButton";
import { NotificationToggle } from "@/components/NotificationToggle";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Compact top bar for mobile (desktop uses the AppShell sidebar). */
export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-card">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" aria-label="Pentix — početna">
          <PentixLogo size={26} />
        </Link>
        <div className="flex items-center gap-1.5">
          {right}
          <NotificationToggle />
          <ThemeToggle />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
