import { useEffect } from "react";

/** Must match Settings.tsx DIGEST_KEY */
const KEY = "finsight_digest_prefs_v1";

type Prefs = {
  enabled?: boolean;
  hour?: number;
  minute?: number;
  sections?: string[];
};

/** Fires a browser notification at the scheduled local time when the app tab is open. */
export function DigestReminder() {
  useEffect(() => {
    const tick = () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const p = JSON.parse(raw) as Prefs;
        if (!p.enabled) return;
        const h = p.hour ?? 7;
        const m = p.minute ?? 30;
        const now = new Date();
        if (now.getHours() !== h || now.getMinutes() !== m) return;
        const sec = now.getSeconds();
        if (sec > 55) return;
        if (Notification.permission !== "granted") return;
        const body =
          (p.sections?.length ?? 0) > 0
            ? p.sections!.join(" · ")
            : "Macro · sector · international · geopolitical · names · tape";
        new Notification("FinSight scheduled digest", {
          body,
          tag: "finsight-digest",
        });
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, 30_000);
    tick();
    return () => window.clearInterval(id);
  }, []);
  return null;
}
