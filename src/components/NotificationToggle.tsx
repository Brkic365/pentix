"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "unsupported" | "loading" | "off" | "on" | "denied";

/** Bell toggle: subscribes this device to web push for goals, bets, interest. */
export function NotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (
      !publicKey ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (sub) setState("on");
        else setState(Notification.permission === "denied" ? "denied" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, [publicKey]);

  async function enable() {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey!) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save failed");
      setState("on");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } catch {
      // device-side unsubscribe failed — server row was already removed
    }
    setState("off");
  }

  if (state === "unsupported") return null;

  const title =
    state === "on"
      ? "Obavijesti su uključene — klikni za isključivanje"
      : state === "denied"
        ? "Obavijesti su blokirane u postavkama preglednika"
        : "Uključi obavijesti o golovima, okladama i kamati";

  return (
    <button
      type="button"
      onClick={state === "on" ? disable : enable}
      disabled={state === "loading" || state === "denied"}
      title={title}
      aria-label={title}
      className={`btn btn-ghost px-2.5 ${state === "on" ? "text-primary" : ""}`}
    >
      {state === "on" ? <Bell className="size-4" /> : <BellOff className="size-4" />}
    </button>
  );
}
