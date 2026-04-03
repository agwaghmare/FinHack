import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, Send } from "lucide-react";
import { api } from "../lib/api";

const items = [
  {
    title: "Crash probability crossed watch level",
    body: "Model estimate briefly exceeded 0.65 — review hedges and cash buffer.",
    level: "warning",
  },
  {
    title: "Macro regime: growth",
    body: "Leading indicators stable; maintain strategic allocation.",
    level: "info",
  },
  {
    title: "Concentration alert",
    body: "Top holding weight above policy band. Consider trim or tax-aware rebalance.",
    level: "risk",
  },
];

export function Alerts() {
  const location = useLocation();
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendTestWebhook() {
    setSending(true);
    setErr(null);
    setLastResult(null);
    setLastOk(false);
    try {
      const res = (await api.triggerAlert({
        message: "FinSight test alert — webhook ping from dashboard.",
        crash_probability: 0.42,
        threshold: 0.65,
        source: "alerts_page",
      })) as Record<string, unknown>;
      setLastResult(JSON.stringify(res, null, 2));
      const st = res.status;
      setLastOk(st === "sent" || st === "received");
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [location.hash]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Alerts center
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Risk & signals
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Backend sends to <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">ZAPIER_WEBHOOK_URL</code>{" "}
            and optional Twilio SMS. Sign in with Clerk so <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">user_id</code>{" "}
            is included when you trigger an alert. If neither is configured, the API still returns{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">status: received</code> and logs the payload
            server-side.
          </p>
        </div>
        <button
          type="button"
          onClick={sendTestWebhook}
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send test alert
        </button>
      </header>

      <section id="how-to-receive" className="glass scroll-mt-24 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          How to receive alerts (not just “received” in the API)
        </h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Zapier (recommended):</strong> In Zapier, create a Zap
            whose trigger is <strong>Catch Hook</strong>. Copy the webhook URL into your API{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">.env</code> as{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">ZAPIER_WEBHOOK_URL</code> (aliases{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">ALERT_WEBHOOK_URL</code> /{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">WEBHOOK_URL</code> also work). Restart the
            FastAPI process, then use <strong>Send test alert</strong> while signed in. The Zap should receive JSON
            including <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">message</code> and{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">user_id</code>. Add Gmail, Slack, or push as
            the Zap action.
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">SMS (Twilio):</strong> Set{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">TWILIO_ACCOUNT_SID</code>,{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">TWILIO_AUTH_TOKEN</code>,{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">TWILIO_FROM_NUMBER</code>, and{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">ALERT_SMS_TO</code> (your phone in E.164).
            Restart the API. A successful SMS counts as delivery even without Zapier.
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Stay signed in:</strong> Use Clerk sign-in before
            sending a test so the payload includes your Clerk <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">user_id</code>{" "}
            (useful for routing in Zapier).
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">If you see </strong>
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">status: received</code>
            <strong className="text-zinc-800 dark:text-zinc-200"> but nothing in your inbox:</strong> that usually means
            neither Zapier nor Twilio is configured; the server still logs the alert. Configure at least one channel
            above.
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">In-app browser reminders:</strong> optional digest
            preferences live under <strong>Settings</strong> (local to your browser); they are separate from webhook/SMS
            alerts.
          </li>
        </ol>
      </section>

      {(lastResult || err) && (
        <div
          className={`rounded-2xl border p-4 text-xs ${
            err
              ? "border-rose-500/40 bg-rose-950/40 text-rose-100"
              : lastOk
                ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-100"
                : "border-amber-500/30 bg-amber-950/30 text-amber-100"
          }`}
        >
          <p className="mb-2 font-semibold">{err ? "Error" : "Last response"}</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] opacity-90">
            {err ?? lastResult}
          </pre>
        </div>
      )}

      <div id="feed" className="scroll-mt-24 grid gap-4">
        {items.map((a) => (
          <div
            key={a.title}
            className="glass rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-glass"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {a.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {a.body}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-900/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-white/10 dark:text-zinc-300">
                {a.level}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
