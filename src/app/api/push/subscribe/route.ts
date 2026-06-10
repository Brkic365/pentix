import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClerkId } from "@/lib/auth";

async function requireApiUser() {
  const clerkId = await getClerkId();
  if (!clerkId) return null;
  return db.user.findUnique({ where: { clerkId } });
}

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  await db.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: { userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    create: {
      userId: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  await db.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: user.id },
  });
  return NextResponse.json({ ok: true });
}
