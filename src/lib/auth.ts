import { auth } from "@clerk/nextjs/server";

/**
 * DEV_AUTH_BYPASS=1 runs the app without Clerk using a single fake local
 * user — for local demos before real Clerk keys exist. Hard-disabled in
 * production builds.
 */
export function devAuthEnabled(): boolean {
  return (
    process.env.DEV_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production"
  );
}

export const DEV_CLERK_ID = "dev_local_user";

/** Clerk user id of the current request, or the dev user when bypassing. */
export async function getClerkId(): Promise<string | null> {
  if (devAuthEnabled()) return DEV_CLERK_ID;
  const { userId } = await auth();
  return userId;
}
