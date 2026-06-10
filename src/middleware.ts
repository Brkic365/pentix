import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cron(.*)", // protected by CRON_SECRET, not by Clerk
  "/manifest.webmanifest",
]);

// DEV_AUTH_BYPASS: local demo mode without Clerk (see src/lib/auth.ts)
const devBypass =
  process.env.DEV_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production";

export default devBypass
  ? function middleware() {
      return NextResponse.next();
    }
  : clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    });

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|wasm|task)).*)",
    "/(api|trpc)(.*)",
  ],
};
