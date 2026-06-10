import webpush from "web-push";
import { db } from "@/lib/db";

/**
 * Server-side web push. Entirely best-effort: when VAPID keys are missing or
 * a send fails, the game goes on — notifications must never break an action.
 */

export interface PushMessage {
  userId: string;
  title: string;
  body: string;
  /** where a tap takes the user */
  url: string;
  /** collapses same-tag notifications (e.g. one per match) */
  tag?: string;
}

let configured: boolean | null = null;

function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@pentix.eu",
      pub,
      priv,
    );
    configured = true;
  } else {
    configured = false;
  }
  return configured;
}

/** Sends per-user payloads; prunes subscriptions the push service rejected. */
export async function sendPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0 || !pushConfigured()) return;

  try {
    const subs = await db.pushSubscription.findMany({
      where: { userId: { in: [...new Set(messages.map((m) => m.userId))] } },
    });
    if (subs.length === 0) return;

    const byUser = new Map<string, typeof subs>();
    for (const s of subs) {
      const list = byUser.get(s.userId) ?? [];
      list.push(s);
      byUser.set(s.userId, list);
    }

    const dead: string[] = [];
    await Promise.allSettled(
      messages.flatMap((m) =>
        (byUser.get(m.userId) ?? []).map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag }),
            );
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) dead.push(sub.id);
          }
        }),
      ),
    );

    if (dead.length > 0) {
      await db.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    }
  } catch {
    // never let notifications take down the action that triggered them
  }
}
