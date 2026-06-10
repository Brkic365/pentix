import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Camera,
  ChartNoAxesColumn,
  Dices,
  Percent,
  Scale,
  Users,
  Video,
} from "lucide-react";
import { devAuthEnabled, getClerkId } from "@/lib/auth";
import { PentixLogo } from "@/components/PentixLogo";

export default async function LandingPage() {
  const userId = await getClerkId();
  // In DEV_AUTH_BYPASS demo mode keep the landing viewable at "/"
  if (userId && !devAuthEnabled()) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-bg">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <PentixLogo size={28} />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
            <a href="#kako" className="hover:text-ink">
              Kako radi
            </a>
            <a href="#formula" className="hover:text-ink">
              Formula
            </a>
            <a href="#znacajke" className="hover:text-ink">
              Značajke
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="btn btn-ghost">
              Prijava
            </Link>
            <Link href="/sign-up" className="btn btn-primary">
              Kreni besplatno
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
        <div>
          <span className="badge badge-green">Svjetsko prvenstvo 2026 · 11. 6. – 19. 7.</span>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            Svaki gol ima cijenu.
            <br />
            <span className="text-primary">Pet sklekova.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Pentix pretvara golove Svjetskog prvenstva u sklek-dug vaše ekipe.
            Kamera broji ponavljanja, ljestvica prati tko koliko duguje, a
            kamata raste dok se dug ne odradi.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="btn btn-primary px-6 py-3 text-base">
              Stvori ligu
            </Link>
            <a href="#kako" className="btn btn-outline px-6 py-3 text-base">
              Pogledaj kako radi
            </a>
          </div>
          <p className="mt-4 text-sm text-muted">
            Besplatno za ekipe prijatelja · radi u pregledniku, bez instalacije
          </p>
        </div>

        {/* Product preview, built from real UI pieces */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <span className="section-title">Tvoj dug</span>
              <span className="badge badge-red">kamata +5%/dan</span>
            </div>
            <div className="mt-2 stat-number text-5xl text-danger">35</div>
            <p className="mt-1 text-sm text-muted">sklekova preostalo</p>
            <div className="mt-4 h-px bg-[var(--border)]" />
            <div className="mt-4 space-y-2.5">
              {[
                { rank: 1, name: "Marko", paid: "plaćeno 35", owes: "7" },
                { rank: 2, name: "Antonio", paid: "plaćeno 20", owes: "15", me: true },
                { rank: 3, name: "Ivan", paid: "plaćeno 0", owes: "35" },
              ].map((r) => (
                <div
                  key={r.rank}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    r.me ? "border-primary-soft-border bg-primary-soft" : "border-line"
                  }`}
                >
                  <span className="w-4 text-sm font-semibold text-muted">{r.rank}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{r.name}</div>
                    <div className="text-xs text-muted">{r.paid}</div>
                  </div>
                  <span className="text-base font-semibold tabular-nums text-danger">
                    {r.owes}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="card absolute -bottom-6 -right-2 hidden w-44 p-3 sm:block">
            <div className="text-xs font-medium text-muted">Kramarić 41′ · Hrvatska</div>
            <div className="mt-1 text-lg font-semibold text-danger">+15 sklekova</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="kako" className="border-t border-line bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-ink">
            Kako radi
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                icon: Users,
                title: "1 · Okupi ekipu",
                text: "Stvori ligu, odaberi reprezentaciju koju pratite i podijeli pozivni kod. Cijeli raspored SP-a 2026 već je učitan.",
              },
              {
                icon: ChartNoAxesColumn,
                title: "2 · Gol postaje dug",
                text: "Kad padne gol, admin ga upiše u par sekundi. Formula ga pretvara u sklekove — po fazi, protivniku i bonusima koje sami odredite.",
              },
              {
                icon: Camera,
                title: "3 · Kamera naplaćuje",
                text: "Snimi set sklekova; računalni vid broji ponavljanja preko kuta lakta. Ti potvrdiš broj, dug pada 1:1, snimka ostaje ekipi na uvid.",
              },
            ].map((s) => (
              <div key={s.title}>
                <div className="flex size-11 items-center justify-center rounded-lg border border-primary-soft-border bg-primary-soft">
                  <s.icon className="size-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formula */}
      <section id="formula" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">
              Formula koju ekipa određuje sama
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              Baza je pet sklekova po golu — zato Pentix (penta = 5). Sve ostalo
              je vaše: množitelji po fazi natjecanja, cijena primljenog gola,
              bonus za omiljenog igrača, kazna za ispadanje, dnevna kamata.
              Formulu postavljate pri stvaranju lige i mijenjate u postavkama u
              bilo kojem trenutku.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li className="flex items-start gap-2.5">
                <Scale className="mt-0.5 size-4 shrink-0 text-primary" />
                Handicap po članu: jači množe dug, ali sklek je sklek — plaćanje
                je uvijek 1:1.
              </li>
              <li className="flex items-start gap-2.5">
                <Percent className="mt-0.5 size-4 shrink-0 text-primary" />
                Kamata se dnevno obračunava na neplaćeni dug, uz strop koji
                sami postavite.
              </li>
            </ul>
          </div>
          <div className="card p-6">
            <div className="section-title">Primjer izračuna</div>
            <div className="mt-4 rounded-lg bg-card-subtle p-4 text-center">
              <div className="text-sm text-muted">primljeni gol u četvrtfinalu</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                5 <span className="text-muted">×</span> 2{" "}
                <span className="text-muted">×</span> 4 ={" "}
                <span className="text-danger">40 sklekova</span>
              </div>
              <div className="mt-2 text-xs text-muted">
                baza × faza (ČF) × primljeni gol
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {[
                ["Gol omiljenog igrača", "+20"],
                ["Kasni gol (85′+)", "+10"],
                ["Gol iz jedanaesterca", "−2"],
                ["Hat-trick, treći gol", "×2"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
                >
                  <span className="text-muted">{k}</span>
                  <span className="font-semibold tabular-nums text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="znacajke" className="border-t border-line bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-ink">
            Sve što natjecanju treba
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ChartNoAxesColumn,
                title: "Ljestvica uživo",
                text: "Tko najmanje duguje — vodi. Osvježava se u stvarnom vremenu dok ekipa upisuje golove i plaća sklekove.",
              },
              {
                icon: Camera,
                title: "Brojanje računalnim vidom",
                text: "MediaPipe praćenje poze broji ponavljanja u pregledniku. Osjetljivost je podesiva, a ti uvijek potvrđuješ konačan broj.",
              },
              {
                icon: Video,
                title: "Video dokazi",
                text: "Svaki snimljeni set ostaje ekipi na uvid — lagana kontrola bez povjerenstva za varanje.",
              },
              {
                icon: Dices,
                title: "Oklade 1 na 1",
                text: "Izazovi prijatelja na ishod utakmice. Ulog je fiksan u sklekovima, gubitnik plaća — bez handicapa.",
              },
              {
                icon: Percent,
                title: "Dnevna kamata",
                text: "Neplaćeni dug raste svaki dan po stopi koju odredite. Pritisak je dio igre.",
              },
              {
                icon: Users,
                title: "Handicap sustav",
                text: "Iskusniji vježbači nakupljaju dug brže (×1.2, ×1.5…), pa liga ostaje poštena za sve razine.",
              },
            ].map((f) => (
              <div key={f.title} className="card p-5">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="card flex flex-col items-center gap-5 p-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">
            Prvenstvo počinje — dug se sam neće odraditi
          </h2>
          <p className="max-w-lg text-muted">
            Stvori ligu, pozovi ekipu i dogovorite formulu prije prvog sučevog
            zvižduka.
          </p>
          <Link href="/sign-up" className="btn btn-primary px-8 py-3 text-base">
            Kreni besplatno
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <PentixLogo size={22} />
          <p>Pentix · sklekovi se broje · SP 2026</p>
        </div>
      </footer>
    </div>
  );
}
