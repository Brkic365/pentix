import Link from "next/link";
import { PentixLogo } from "@/components/PentixLogo";
import { AuthButton } from "@/components/AuthButton";

/** Shared top bar for signed-in app pages. */
export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-card">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" aria-label="Pentix — početna">
          <PentixLogo size={26} />
        </Link>
        <div className="flex items-center gap-3">
          {right}
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
