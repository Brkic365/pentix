import Link from "next/link";
import {
  BookOpen,
  Camera,
  CalendarDays,
  ChartNoAxesColumn,
  Home,
  LayoutGrid,
  Plus,
  Settings,
  Video,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/users";
import { computeDebt } from "@/lib/engine/interest";
import { AppHeader } from "@/components/AppHeader";
import { AuthButton } from "@/components/AuthButton";
import { NotificationToggle } from "@/components/NotificationToggle";
import { PentixLogo } from "@/components/PentixLogo";
import { TeamFlag } from "@/components/TeamFlag";
import { ThemeToggle } from "@/components/ThemeToggle";

export type ShellSection =
  | "dashboard"
  | "new"
  | "league-overview"
  | "league-matches"
  | "league-ledger"
  | "league-stats"
  | "league-activity"
  | "league-settings";

interface LeagueContext {
  id: string;
  name: string;
  mainCountry: { name: string; flagUrl: string | null };
  isAdmin: boolean;
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary-soft text-primary"
          : accent
            ? "text-primary hover:bg-primary-soft"
            : "text-muted hover:bg-card-subtle hover:text-ink"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

/**
 * App frame for signed-in pages: persistent sidebar on desktop, the compact
 * top bar on mobile.
 */
export async function AppShell({
  section,
  league,
  headerRight,
  children,
}: {
  section: ShellSection;
  league?: LeagueContext;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const memberships = await db.member.findMany({
    where: { userId: user.id },
    include: {
      tournament: { include: { mainCountry: true } },
      ledgerEntries: { select: { amount: true, type: true, createdAt: true } },
    },
    orderBy: { joinedAt: "desc" },
  });

  const leagueList = memberships.map((m) => ({
    id: m.tournamentId,
    name: m.tournament.name,
    flagUrl: m.tournament.mainCountry.flagUrl,
    countryName: m.tournament.mainCountry.name,
    outstanding: computeDebt(m.ledgerEntries).outstanding,
  }));

  return (
    <div className="min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-card lg:flex">
        <div className="flex h-14 items-center border-b border-line px-4">
          <Link href="/dashboard" aria-label="Pentix — početna">
            <PentixLogo size={26} />
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          <div className="space-y-0.5">
            <NavItem
              href="/dashboard"
              icon={LayoutGrid}
              label="Moje lige"
              active={section === "dashboard"}
            />
            <NavItem
              href="/new"
              icon={Plus}
              label="Nova liga"
              active={section === "new"}
            />
          </div>

          {league && (
            <div>
              <div className="flex items-center gap-2 px-3 pb-2">
                <TeamFlag
                  flagUrl={league.mainCountry.flagUrl}
                  name={league.mainCountry.name}
                  size={13}
                />
                <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted">
                  {league.name}
                </span>
              </div>
              <div className="space-y-0.5">
                <NavItem
                  href={`/t/${league.id}`}
                  icon={Home}
                  label="Pregled"
                  active={section === "league-overview"}
                />
                <NavItem
                  href={`/t/${league.id}/matches`}
                  icon={CalendarDays}
                  label="Utakmice"
                  active={section === "league-matches"}
                />
                <NavItem
                  href={`/t/${league.id}/ledger`}
                  icon={BookOpen}
                  label="Knjižica"
                  active={section === "league-ledger"}
                />
                <NavItem
                  href={`/t/${league.id}/stats`}
                  icon={ChartNoAxesColumn}
                  label="Statistika"
                  active={section === "league-stats"}
                />
                <NavItem
                  href={`/t/${league.id}/activity`}
                  icon={Video}
                  label="Dokazi"
                  active={section === "league-activity"}
                />
                <NavItem
                  href={`/t/${league.id}/record`}
                  icon={Camera}
                  label="Snimi sklekove"
                  accent
                />
                {league.isAdmin && (
                  <NavItem
                    href={`/t/${league.id}/settings`}
                    icon={Settings}
                    label="Postavke"
                    active={section === "league-settings"}
                  />
                )}
              </div>
            </div>
          )}

          {leagueList.length > 0 && (
            <div>
              <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Tvoje lige
              </div>
              <div className="space-y-0.5">
                {leagueList.map((l) => (
                  <Link
                    key={l.id}
                    href={`/t/${l.id}`}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      league?.id === l.id
                        ? "bg-card-subtle font-medium text-ink"
                        : "text-muted hover:bg-card-subtle hover:text-ink"
                    }`}
                  >
                    <TeamFlag flagUrl={l.flagUrl} name={l.countryName} size={13} />
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    {l.outstanding > 0 ? (
                      <span className="text-xs font-semibold tabular-nums text-danger">
                        {l.outstanding}
                      </span>
                    ) : (
                      <span className="text-xs text-primary">✓</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="flex items-center gap-2 border-t border-line p-3">
          <AuthButton />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {user.displayName}
          </span>
          <NotificationToggle />
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden">
        <AppHeader right={headerRight} />
      </div>

      <div className="lg:pl-64">{children}</div>
    </div>
  );
}
