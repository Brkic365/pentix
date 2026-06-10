import { requireMember } from "@/lib/users";
import { getMemberDebt } from "@/lib/queries";
import { RecordFlow } from "@/components/RecordFlow";

export const dynamic = "force-dynamic";

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member } = await requireMember(id);
  const debt = await getMemberDebt(member.id);

  return (
    <main className="mx-auto w-full max-w-lg">
      <RecordFlow tournamentId={id} outstanding={debt.outstanding} />
    </main>
  );
}
