/**
 * PWA helpers: install prompt (Chrome/Edge/Android), iOS "Add to Home Screen" detection, online status.
 * `beforeinstallprompt` can fire before React mounts, so it is captured at module load.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function useInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const standalone = isStandalone();
  const install = useCallback(async () => {
    if (!deferred) return;
    const ev = deferred;
    await ev.prompt();
    await ev.userChoice.catch(() => undefined);
    deferred = null;
    notify();
  }, []);
  return {
    /** The browser can show its native install dialog right now. */
    canPrompt,
    /** iOS Safari has no prompt API: show "Share → Add to Home Screen" instructions instead. */
    showIosHint: !standalone && isIOS(),
    installed: standalone,
    install,
  };
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}
