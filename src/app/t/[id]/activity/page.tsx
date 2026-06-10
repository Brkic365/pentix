import Link from "next/link";
import { ArrowLeft, Flag } from "lucide-react";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { formatDateTime } from "@/lib/format";
import { toggleSetFlag } from "@/actions/flags";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

/** Accountability corner: every recorded set, clip included. */
export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member, tournament } = await requireMember(id);

  const sets = await db.pushupSet.findMany({
    where: { member: { tournamentId: id } },
    include: {
      member: { include: { user: true } },
      flags: { select: { memberId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AppShell
      section="league-activity"
      league={{
        id,
        name: tournament.name,
        mainCountry: tournament.mainCountry,
        isAdmin: member.role === "ADMIN",
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
            Dokazi
          </h1>
          <p className="mt-1 text-sm text-muted">
            Svaki snimljeni set ostaje ekipi na uvid.
          </p>
        </div>

        {sets.length === 0 && (
          <p className="card p-8 text-center text-sm text-muted">
            Još nitko nije snimio nijedan set.
          </p>
        )}

        <div className="space-y-3">
          {sets.map((s) => {
            const flaggedByMe = s.flags.some((f) => f.memberId === member.id);
            return (
            <article key={s.id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">
                      {s.member.user.displayName}
                    </span>
                    {s.flags.length > 0 && (
                      <span className="badge badge-amber">
                        <Flag className="size-3" />
                        {s.flags.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {formatDateTime(s.createdAt)} · kamera izbrojala {s.cvReps} ·
                    pouzdanost {Math.round(s.cvConfidence * 100)}%
                    {s.reps !== s.cvReps && " · ručno ispravljeno"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.memberId !== member.id && (
                    <form action={toggleSetFlag.bind(null, s.id)}>
                      <button
                        title={flaggedByMe ? "Povuci prijavu" : "Prijavi sumnjiv set"}
                        aria-label={flaggedByMe ? "Povuci prijavu" : "Prijavi sumnjiv set"}
                        className={`btn px-2 py-1.5 ${
                          flaggedByMe ? "btn-danger-outline" : "btn-ghost"
                        }`}
                      >
                        <Flag className="size-4" />
                      </button>
                    </form>
                  )}
                  <div className="text-right">
                    <div className="text-xl font-semibold tabular-nums text-primary">
                      −{s.reps}
                    </div>
                    <div className="text-[11px] text-muted">duga</div>
                  </div>
                </div>
              </div>
              {s.videoUrl ? (
                <video
                  src={s.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="mt-3 max-h-72 w-full rounded-lg border border-line bg-black object-contain"
                />
              ) : (
                <p className="mt-3 text-xs italic text-muted">
                  Set je upisan bez snimke.
                </p>
              )}
            </article>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
