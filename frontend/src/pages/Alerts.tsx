import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  Radio,
  Send,
  Shield,
  Webhook,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";

const LS_RISK = "alerts_risk_threshold";
const LS_CONC = "alerts_conc_threshold";

type SignalRow = {
  id: string;
  severity: string;
  title: string;
  detail?: string;
};

type ActivityItem = { at: string; kind: string; ok: boolean; detail: string };

function severityStyle(sev: string) {
  switch (sev) {
    case "risk":
      return "border-rose-500/35 bg-rose-950/25 text-rose-100";
    case "warning":
      return "border-amber-500/35 bg-amber-950/20 text-amber-100";
    default:
      return "border-zinc-700 bg-zinc-900/50 text-zinc-200";
  }
}

export function Alerts() {
  const location = useLocation();
  const { user, isSignedIn } = useUser();
  const [sending, setSending] = useState(false);
  const [digestBusy, setDigestBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<{
    webhook?: boolean;
    sms?: boolean;
    email?: boolean;
    any_channel?: boolean;
  } | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalsPayload, setSignalsPayload] = useState<{
    portfolio_risk_score?: number;
    portfolio_risk_label?: string;
    spy_1m_return_pct?: number | null;
    signals?: SignalRow[];
    as_of?: string;
  } | null>(null);
  const [riskThreshold, setRiskThreshold] = useState(7);
  const [concThreshold, setConcThreshold] = useState(0.35);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    try {
      const r = localStorage.getItem(LS_RISK);
      const c = localStorage.getItem(LS_CONC);
      if (r != null) {
        const n = Number.parseFloat(r);
        if (Number.isFinite(n)) setRiskThreshold(n);
      }
      if (c != null) {
        const n = Number.parseFloat(c);
        if (Number.isFinite(n)) setConcThreshold(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistThresholds = useCallback((r: number, co: number) => {
    try {
      localStorage.setItem(LS_RISK, String(r));
      localStorage.setItem(LS_CONC, String(co));
    } catch {
      /* ignore */
    }
  }, []);

  const pushActivity = useCallback((kind: string, ok: boolean, detail: string) => {
    const at = new Date().toISOString();
    setActivity((prev) => [{ at, kind, ok, detail }, ...prev].slice(0, 8));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api.alertDelivery();
        if (!cancelled) setDelivery(d as typeof delivery);
      } catch {
        if (!cancelled) setDelivery(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSignals = useCallback(async () => {
    if (!isSignedIn || !user?.id) {
      setSignalsPayload(null);
      return;
    }
    setSignalsLoading(true);
    try {
      const raw = await api.alertSignals({
        riskAlert: riskThreshold,
        concentration: concThreshold,
      });
      setSignalsPayload(raw as typeof signalsPayload);
    } catch {
      setSignalsPayload(null);
    } finally {
      setSignalsLoading(false);
    }
  }, [isSignedIn, user?.id, riskThreshold, concThreshold]);

  useEffect(() => {
    void loadSignals();
  }, [loadSignals]);

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [location.hash]);

  async function sendTestAlert() {
    setSending(true);
    setErr(null);
    setLastResult(null);
    setLastOk(false);
    try {
      const res = (await api.triggerAlert({
        message:
          "FinSight test alert — SMS / email delivery check (optional HTTP webhook). If Twilio or SMTP is configured, you should receive this outside the app.",
        crash_probability: 0.42,
        threshold: 0.65,
        source: "alerts_page",
      })) as Record<string, unknown>;
      setLastResult(JSON.stringify(res, null, 2));
      const st = res.status as string;
      const delivered =
        st === "sent" &&
        !!(res.twilio_sent || res.email_sent || res.webhook_sent);
      setLastOk(delivered);
      pushActivity("Test ping", delivered, st ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setErr(msg);
      pushActivity("Test ping", false, msg);
    } finally {
      setSending(false);
    }
  }

  async function sendDigest() {
    if (!isSignedIn) return;
    setDigestBusy(true);
    setErr(null);
    setLastResult(null);
    try {
      const res = (await api.alertDigest({
        risk_alert_threshold: riskThreshold,
        concentration_threshold: concThreshold,
      })) as Record<string, unknown>;
      setLastResult(JSON.stringify(res, null, 2));
      const st = res.status as string;
      const delivered =
        st === "sent" &&
        !!(res.twilio_sent || res.email_sent || res.webhook_sent);
      setLastOk(delivered);
      pushActivity("Risk digest", delivered, st ?? "");
      await loadSignals();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setErr(msg);
      pushActivity("Risk digest", false, msg);
    } finally {
      setDigestBusy(false);
    }
  }

  async function sendRiskOnly() {
    if (!user?.id) return;
    setSending(true);
    setErr(null);
    try {
      const rs = signalsPayload?.portfolio_risk_score;
      const msg = `Portfolio risk alert: ${typeof rs === "number" ? `${rs}/10` : "n/a"} (${signalsPayload?.portfolio_risk_label ?? "—"}). Review diversification.`;
      const res = (await api.alertRisk(user.id, { message: msg })) as Record<string, unknown>;
      setLastResult(JSON.stringify(res, null, 2));
      const st = res.status as string;
      const delivered =
        st === "sent" &&
        !!(res.twilio_sent || res.email_sent || res.webhook_sent);
      setLastOk(delivered);
      pushActivity("Risk-only alert", delivered, st ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setErr(msg);
      pushActivity("Risk-only alert", false, msg);
    } finally {
      setSending(false);
    }
  }

  const channelCards = useMemo(
    () => [
      {
        key: "sms",
        label: "SMS (Twilio)",
        desc: "Text alerts to your phone (E.164 in env)",
        on: delivery?.sms,
        icon: MessageSquare,
      },
      {
        key: "email",
        label: "Email (SMTP)",
        desc: "Inbox delivery — Gmail app password, SendGrid, etc.",
        on: delivery?.email,
        icon: Mail,
      },
      {
        key: "webhook",
        label: "HTTP webhook (optional)",
        desc: "Only if you want JSON POST to your own URL",
        on: delivery?.webhook,
        icon: Webhook,
      },
    ],
    [delivery],
  );

  const deliveryHints = useMemo(() => {
    if (!lastResult) return null;
    try {
      const o = JSON.parse(lastResult) as Record<string, unknown>;
      const h = o.delivery_hints ?? o.delivery_warnings;
      return Array.isArray(h) ? (h as string[]) : null;
    } catch {
      return null;
    }
  }, [lastResult]);

  return (
    <div className="space-y-10 pb-16">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-950 via-zinc-900/90 to-emerald-950/20 px-6 py-8 sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-500/90">
              Alerts center
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Risk & signals
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Deliver digests to your phone (SMS) and inbox (SMTP). No third-party automation tools required. An optional
              HTTP webhook is available if you want to POST JSON to your own endpoint. Configure keys in{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">.env</code> — sign
              in so payloads include your user id.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void sendTestAlert()}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Send test
            </button>
            <button
              type="button"
              onClick={() => void sendDigest()}
              disabled={digestBusy || !isSignedIn}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {digestBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send full digest
            </button>
          </div>
        </div>
      </header>

      {/* Delivery grid */}
      <section className="grid gap-4 md:grid-cols-3">
        {channelCards.map(({ key, label, desc, on, icon: Icon }) => (
          <div
            key={key}
            className={`flex flex-col rounded-2xl border p-5 transition ${
              on
                ? "border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
                : "border-zinc-800 bg-zinc-950/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 ring-1 ring-zinc-700/80">
                <Icon className={`h-5 w-5 ${on ? "text-emerald-400" : "text-zinc-500"}`} />
              </div>
              {on ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
              ) : (
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-semibold uppercase text-zinc-500">
                  Not set
                </span>
              )}
            </div>
            <p className="mt-4 text-sm font-semibold text-zinc-100">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{desc}</p>
          </div>
        ))}
      </section>

      {/* Thresholds + live signals */}
      <section className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2 space-y-4 rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="flex items-center gap-2 text-zinc-100">
            <Shield className="h-5 w-5 text-emerald-500/90" />
            <h2 className="text-lg font-semibold">Signal thresholds</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Used when evaluating your holdings and when sending a digest. Stored in this browser only.
          </p>
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Risk alert at (0–10)
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={3}
                max={9}
                step={0.5}
                value={riskThreshold}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  setRiskThreshold(v);
                  persistThresholds(v, concThreshold);
                }}
                className="h-2 flex-1 accent-emerald-500"
              />
              <span className="w-12 tabular-nums text-sm font-semibold text-zinc-200">{riskThreshold}</span>
            </div>
          </label>
          <label className="block pt-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Concentration flag (% of portfolio)
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0.2}
                max={0.6}
                step={0.05}
                value={concThreshold}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  setConcThreshold(v);
                  persistThresholds(riskThreshold, v);
                }}
                className="h-2 flex-1 accent-amber-500"
              />
              <span className="w-12 tabular-nums text-sm font-semibold text-zinc-200">
                {(concThreshold * 100).toFixed(0)}%
              </span>
            </div>
          </label>
          <button
            type="button"
            onClick={() => void loadSignals()}
            className="mt-2 w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Refresh signals
          </button>
        </div>

        <div className="xl:col-span-3 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-sky-400/90" />
              <h2 className="text-lg font-semibold text-zinc-100">Live signals</h2>
            </div>
            {!isSignedIn ? (
              <span className="text-xs text-amber-400/90">Sign in to load your portfolio signals</span>
            ) : signalsLoading ? (
              <span className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing…
              </span>
            ) : (
              <span className="text-[11px] text-zinc-500">As of {signalsPayload?.as_of ?? "—"}</span>
            )}
          </div>

          {isSignedIn && signalsPayload && (
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                <span className="text-zinc-500">Portfolio risk</span>
                <p className="mt-0.5 font-semibold tabular-nums text-zinc-100">
                  {typeof signalsPayload.portfolio_risk_score === "number"
                    ? `${signalsPayload.portfolio_risk_score.toFixed(1)}/10`
                    : "—"}{" "}
                  <span className="font-normal text-zinc-500">
                    ({signalsPayload.portfolio_risk_label ?? "—"})
                  </span>
                </p>
              </div>
              {signalsPayload.spy_1m_return_pct != null && (
                <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2">
                  <span className="text-zinc-500">SPY ~30d</span>
                  <p
                    className={`mt-0.5 font-semibold tabular-nums ${
                      signalsPayload.spy_1m_return_pct < 0 ? "text-rose-300" : "text-emerald-300"
                    }`}
                  >
                    {signalsPayload.spy_1m_return_pct >= 0 ? "+" : ""}
                    {signalsPayload.spy_1m_return_pct.toFixed(2)}%
                  </p>
                </div>
              )}
            </div>
          )}

          <ul className="mt-5 space-y-3">
            {!isSignedIn ? (
              <li className="rounded-xl border border-dashed border-zinc-700 px-4 py-8 text-center text-sm text-zinc-500">
                Connect your account to see concentration checks, risk flags, and market context for your holdings.
              </li>
            ) : signalsLoading ? null : (
              (signalsPayload?.signals ?? []).map((s) => (
                <li
                  key={s.id}
                  className={`rounded-xl border px-4 py-3 text-sm ${severityStyle(s.severity)}`}
                >
                  <p className="font-semibold leading-snug">{s.title}</p>
                  {s.detail ? <p className="mt-1 text-xs opacity-90 leading-relaxed">{s.detail}</p> : null}
                </li>
              ))
            )}
          </ul>

          {isSignedIn && !signalsLoading && signalsPayload?.portfolio_risk_score != null && (
            <button
              type="button"
              onClick={() => void sendRiskOnly()}
              disabled={sending}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              <Bell className="h-4 w-4" />
              Push risk-only alert now
            </button>
          )}
        </div>
      </section>

      {/* Activity */}
      {activity.length > 0 && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/30 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Recent actions</h2>
          <ul className="mt-3 space-y-2">
            {activity.map((a, i) => (
              <li
                key={`${a.at}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2 text-xs"
              >
                <span className="text-zinc-500">{new Date(a.at).toLocaleString()}</span>
                <span className="font-medium text-zinc-200">{a.kind}</span>
                <span className={a.ok ? "text-emerald-400" : "text-rose-400"}>{a.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          <p className="mb-2 font-semibold">{err ? "Error" : "Last API response"}</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] opacity-90">
            {err ?? lastResult}
          </pre>
          {deliveryHints && deliveryHints.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-950/30 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
                What to fix
              </p>
              <ul className="list-disc space-y-2 pl-4 text-[11px] leading-relaxed text-amber-100/90">
                {deliveryHints.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <section id="how-to-receive" className="scroll-mt-24 rounded-3xl border border-zinc-800 bg-zinc-950/50 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <ChevronRight className="h-5 w-5 text-zinc-500" />
          Wire up phone & email
        </h2>
        <ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-zinc-400">
          <li>
            <strong className="text-zinc-200">SMS:</strong>{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">TWILIO_ACCOUNT_SID</code>,{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">TWILIO_AUTH_TOKEN</code>,{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">TWILIO_FROM_NUMBER</code>,{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">ALERT_SMS_TO</code> (your phone, E.164).
          </li>
          <li>
            <strong className="text-zinc-200">Email:</strong>{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">SMTP_HOST</code>,{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">SMTP_PORT</code> (587 or 465),{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">SMTP_USER</code>,{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">SMTP_PASSWORD</code>,{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">ALERT_EMAIL_FROM</code>,{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">ALERT_EMAIL_TO</code>. Restart the API after
            changes.
          </li>
          <li>
            <strong className="text-zinc-200">Optional HTTP webhook:</strong> set{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px] text-emerald-300">ALERT_WEBHOOK_URL</code>{" "}
            (or legacy <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">WEBHOOK_URL</code>) to receive the
            same JSON payload at your own URL.
          </li>
          <li>
            <strong className="text-zinc-200">Twilio 401 Unauthorized:</strong> the Account SID and Auth Token pair is
            wrong or the token was rotated. In Twilio Console → Account → API keys & tokens, copy the{" "}
            <em>Auth Token</em> (not an API Key secret). Restart the API after updating{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">.env</code>.
          </li>
          <li>
            <strong className="text-zinc-200">Status: received</strong> means nothing was delivered — fix SMS/SMTP/webhook
            until the API returns <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">twilio_sent</code>,{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">email_sent</code>, or{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">webhook_sent</code> as{" "}
            <code className="rounded bg-zinc-900 px-1 font-mono text-[11px]">true</code>.
          </li>
        </ol>
      </section>
    </div>
  );
}
