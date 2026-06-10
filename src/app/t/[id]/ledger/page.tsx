import Link from "next/link";
import { ArrowLeft, Dices, Dumbbell, Percent, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { computeDebt } from "@/lib/engine/interest";
import { formatDateTime } from "@/lib/format";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const TYPE_META = {
  ACCRUAL: { icon: TrendingUp, cls: "text-danger", label: "dug" },
  BET: { icon: Dices, cls: "text-danger", label: "oklada" },
  INTEREST: { icon: Percent, cls: "text-danger", label: "kamata" },
  PAYMENT: { icon: Dumbbell, cls: "text-primary", label: "uplata" },
} as const;

/** The debt statement: every line of one member's ledger, with running balance. */
export default async function LedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  const { id } = await params;
  const { member: memberParam } = await searchParams;
  const { member: me, tournament } = await requireMember(id);

  const members = await db.member.findMany({
    where: { tournamentId: id },
    include: { user: true },
    orderBy: { joinedAt: "asc" },
  });
  const selected =
    members.find((m) => m.id === memberParam) ??
    members.find((m) => m.id === me.id)!;

  const entries = await db.ledgerEntry.findMany({
    where: { memberId: selected.id },
    orderBy: { createdAt: "asc" },
  });

  // chronological running balance (newest shown first)
  let balance = 0;
  const withBalance = entries.map((e) => {
    balance += e.type === "PAYMENT" ? -e.amount : e.amount;
    return { ...e, balance };
  });
  const debt = computeDebt(entries);

  return (
    <AppShell
      section="league-ledger"
      league={{
        id,
        name: tournament.name,
        mainCountry: tournament.mainCountry,
        isAdmin: me.role === "ADMIN",
      }}
    >
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <div className="py-8">
          <Link
            href={`/t/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Natrag na ligu
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            Knjižica
          </h1>
          <p className="mt-1 text-sm text-muted">
            Svaka stavka duga, crno na bijelo — transparentnost je pola discipline.
          </p>
        </div>

        {/* member picker */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {members.map((m) => (
            <Link
              key={m.id}
              href={`/t/${id}/ledger?member=${m.id}`}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                m.id === selected.id
                  ? "border-primary-soft-border bg-primary-soft text-primary"
                  : "border-line bg-card text-muted hover:text-ink"
              }`}
            >
              {m.user.displayName}
              {m.id === me.id && " (ti)"}
            </Link>
          ))}
        </div>

        {/* summary */}
        <section className="mt-4 grid grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="text-xs font-medium text-muted">Preostali dug</div>
            <div
              className={`stat-number mt-1 ${
                debt.outstanding > 0 ? "text-danger" : "text-primary"
              }`}
            >
              {debt.outstanding}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium text-muted">Ukupno zaduženo</div>
            <div className="stat-number mt-1 text-ink">
              {debt.lifetimePrincipal + debt.lifetimeInterest}
            </div>
            <div className="mt-1 text-xs text-muted">
              od toga kamata {debt.lifetimeInterest}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-medium text-muted">Ukupno plaćeno</div>
            <div className="stat-number mt-1 text-primary">{debt.totalPaid}</div>
          </div>
        </section>

        {/* statement */}
        {withBalance.length === 0 ? (
          <p className="card mt-4 p-8 text-center text-sm text-muted">
            Prazna knjižica — još ni duga ni uplata.
          </p>
        ) : (
          <div className="card mt-4 divide-y divide-[var(--border)]">
            {[...withBalance].reverse().map((e) => {
              const meta = TYPE_META[e.type as keyof typeof TYPE_META];
              const Icon = meta.icon;
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-card-subtle ${meta.cls}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {e.reason}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {formatDateTime(e.createdAt)} · {meta.label}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-semibold tabular-nums ${meta.cls}`}>
                      {e.type === "PAYMENT" ? "−" : "+"}
                      {e.amount}
                    </div>
                    <div className="text-[11px] tabular-nums text-muted">
                      = {e.balance}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
