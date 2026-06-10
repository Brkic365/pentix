import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { PentixLogo, PentixMark } from "@/components/PentixLogo";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="sahovnica flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <PentixLogo size={30} />
        <Link
          href="/sign-in"
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink"
        >
          Prijava
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <PentixMark size={84} />
        <h1 className="font-display mt-6 text-5xl leading-[1.05] sm:text-7xl">
          GOL PADA.
          <br />
          <span className="text-volt">TI PADAŠ</span>
          <br />
          NA SKLEKOVE.
        </h1>
        <p className="mt-5 max-w-md text-balance text-muted">
          Svaki gol na Svjetskom prvenstvu 2026 puni tvoj sklek-dug —{" "}
          <span className="font-semibold text-ink">penta&nbsp;=&nbsp;5</span>, pet
          sklekova po golu, množi se po fazi i protivniku. Kamera broji, kamata
          raste, ekipa gleda.
        </p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <Link
            href="/sign-up"
            className="record-pulse rounded-2xl bg-volt px-6 py-4 text-center font-display text-xl text-pitch"
          >
            UPADAJ U IGRU
          </Link>
          <Link
            href="/sign-in"
            className="rounded-2xl border border-line px-6 py-4 text-center font-semibold text-ink"
          >
            Već dužan? Prijavi se
          </Link>
        </div>
        <p className="mt-10 text-xs uppercase tracking-[0.25em] text-muted">
          dug se ne oprašta · kamata ne spava
        </p>
      </section>
    </main>
  );
}
