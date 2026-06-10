import { UserButton } from "@clerk/nextjs";
import { devAuthEnabled } from "@/lib/auth";

/** Clerk's UserButton, or a static badge in DEV_AUTH_BYPASS demo mode. */
export function AuthButton() {
  if (devAuthEnabled()) {
    return (
      <span
        title="Dev korisnik (DEV_AUTH_BYPASS)"
        className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg"
      >
        A
      </span>
    );
  }
  return <UserButton />;
}
