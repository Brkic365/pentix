import Link from "next/link";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/users";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Anti-cheat corner: every recorded set, clip included, for the whole crew. */
export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireMember(id);

  const sets = await db.pushupSet.findMany({
    where: { member: { tournamentId: id } },
    include: { member: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 pb-16">
      <header className="flex items-center gap-3 py-4">
        <Link href={`/t/${id}`} className="text-muted">
          ←
        </Link>
        <div>
          <h1 className="font-display text-2xl">DOKAZI</h1>
          <p className="text-xs text-muted">
            Svaki set, svaka snimka. Ekipa kontrolira ekipu. 👀
          </p>
        </div>
      </header>

      {sets.length === 0 && (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5 text-center text-sm text-muted">
          Još nitko ništa nije platio. Sramota.
        </p>
      )}

      <div className="space-y-3">
        {sets.map((s) => (
          <article key={s.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{s.member.user.displayName}</div>
                <div className="text-[11px] text-muted">
                  {formatDateTime(s.createdAt)} · kamera: {s.cvReps} · pouzdanost{" "}
                  {Math.round(s.cvConfidence * 100)}%
                  {s.reps !== s.cvReps && " · ručno ispravljeno"}
                </div>
              </div>
              <div className="shrink-0 rounded-xl bg-volt/15 px-3 py-1.5 font-display text-xl text-volt">
                −{s.reps}
              </div>
            </div>
            {s.videoUrl ? (
              <video
                src={s.videoUrl}
                controls
                playsInline
                preload="metadata"
                className="mt-3 max-h-72 w-full rounded-xl border border-line bg-black object-contain"
              />
            ) : (
              <p className="mt-3 text-xs italic text-muted">
                bez snimke — vjerujemo mu na riječ (ovaj put)
              </p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
