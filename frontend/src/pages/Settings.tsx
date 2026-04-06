import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { InvestmentPreferencesFields } from "../components/InvestmentPreferencesFields";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, apiBase } from "../lib/api";
import {
  FINHACK_INVESTMENT_PREFS_KEY,
  type InvestmentPrefs,
  type InvestmentStyleId,
  type RiskToleranceId,
  defaultInvestmentPrefs,
  parseInvestmentPrefs,
} from "../lib/investmentPreferences";

type Health = {
  status?: string;
  market_ohlc?: boolean;
  market_ohlc_api_prefix?: boolean;
  market_quotes_provider?: string;
  news_pipeline?: string;
  market_cross_asset?: boolean;
  ai_explain?: boolean;
  mistral_key_loaded?: boolean;
};

const NOTIF_KEY = "finsight_notification_prefs_v1";
const DIGEST_KEY = "finsight_digest_prefs_v1";

const DIGEST_SECTIONS: { id: string; label: string }[] = [
  { id: "macro", label: "Macro: broad macro headline" },
  { id: "sector", label: "Sector: industry or theme" },
  { id: "intl", label: "International: overseas / FX" },
  { id: "geo", label: "Geopolitical: policy / conflict" },
  { id: "names", label: "Two names: earnings / catalysts" },
  { id: "tape", label: "Tape + sentiment: movers & tone" },
];

function NotificationAndDigestSettings() {
  const [email, setEmail] = useState(false);
  const [phone, setPhone] = useState(false);
  const [autoPodcast, setAutoPodcast] = useState(false);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(30);
  const [sections, setSections] = useState<string[]>(DIGEST_SECTIONS.map((s) => s.id));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const n = localStorage.getItem(NOTIF_KEY);
      if (n) {
        const p = JSON.parse(n) as { email?: boolean; phone?: boolean; autoPodcast?: boolean };
        setEmail(!!p.email);
        setPhone(!!p.phone);
        setAutoPodcast(!!p.autoPodcast);
      }
      const d = localStorage.getItem(DIGEST_KEY);
      if (d) {
        const p = JSON.parse(d) as {
          enabled?: boolean;
          hour?: number;
          minute?: number;
          sections?: string[];
        };
        setDigestEnabled(!!p.enabled);
        if (p.hour != null) setHour(p.hour);
        if (p.minute != null) setMinute(p.minute);
        if (p.sections?.length) setSections(p.sections);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      NOTIF_KEY,
      JSON.stringify({ email, phone, autoPodcast, updated_at: new Date().toISOString() }),
    );
  }, [hydrated, email, phone, autoPodcast]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      DIGEST_KEY,
      JSON.stringify({
        enabled: digestEnabled,
        hour,
        minute,
        sections,
        updated_at: new Date().toISOString(),
      }),
    );
  }, [hydrated, digestEnabled, hour, minute, sections]);

  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
  }

  function toggleSection(id: string) {
    setSections((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <>
      <div className="glass max-w-2xl rounded-2xl p-6">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Notifications (local prefs)</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Toggles are stored in this browser. Delivering email/SMS still requires backend env (SMTP,
          Twilio) and server-side rules — these switches tell the product what you want when those are
          connected.
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={email}
              onChange={(e) => setEmail(e.target.checked)}
              className="rounded border-zinc-500"
            />
            Email digests (when SMTP is configured on the API)
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={phone}
              onChange={(e) => setPhone(e.target.checked)}
              className="rounded border-zinc-500"
            />
            SMS alerts (Twilio + <code className="text-xs">ALERT_SMS_TO</code>)
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={autoPodcast}
              onChange={(e) => setAutoPodcast(e.target.checked)}
              className="rounded border-zinc-500"
            />
            Auto-queue market open/close podcasts when ElevenLabs is available
          </label>
        </div>
      </div>

      <div className="glass max-w-2xl rounded-2xl p-6">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Scheduled digest reminder</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Browser notification at a daily time while this tab is open — use it as a nudge to read the
          sections below (same outline as the podcast script).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={digestEnabled}
              onChange={(e) => setDigestEnabled(e.target.checked)}
            />
            Enable reminder
          </label>
          <label className="flex items-center gap-1 text-sm">
            <span className="text-zinc-500">Time (local)</span>
            <input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-14 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm"
            />
            :
            <input
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="w-14 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void requestNotifPermission()}
            className="rounded-full border border-zinc-600 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-400"
          >
            Allow browser notifications
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {DIGEST_SECTIONS.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={sections.includes(s.id)}
                onChange={() => toggleSection(s.id)}
                className="mt-0.5"
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function InvestmentPreferencesSettings() {
  const { user, isLoaded } = useUser();
  const [prefs, setPrefs] = useState<InvestmentPrefs>(() => defaultInvestmentPrefs());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setPrefs(parseInvestmentPrefs(user.unsafeMetadata?.[FINHACK_INVESTMENT_PREFS_KEY]));
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    const next: InvestmentPrefs = {
      ...prefs,
      onboardingComplete: true,
      updatedAt: new Date().toISOString(),
    };
    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          [FINHACK_INVESTMENT_PREFS_KEY]: next,
        },
      });
      setPrefs(next);
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function setRisk(id: RiskToleranceId) {
    setPrefs((p) => ({ ...p, riskTolerance: id }));
  }

  function toggleStyle(id: InvestmentStyleId) {
    setPrefs((p) => {
      const next = new Set(p.styles);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...p, styles: [...next] };
    });
  }

  if (!isLoaded) {
    return (
      <div className="glass max-w-2xl rounded-2xl p-6">
        <p className="text-sm text-zinc-500">Loading preferences…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="glass max-w-2xl rounded-2xl p-6">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">Investment preferences</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Risk tolerance and style focus help us frame insights and examples for research and education. They are
        not investment recommendations.
      </p>
      <div className="mt-6">
        <InvestmentPreferencesFields
          riskTolerance={prefs.riskTolerance}
          styles={prefs.styles}
          onRiskChange={setRisk}
          onToggleStyle={toggleStyle}
          disabled={saving}
        />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save preferences
        </button>
        {prefs.updatedAt ? (
          <span className="text-xs text-zinc-500">
            Last updated: {new Date(prefs.updatedAt).toLocaleString()}
          </span>
        ) : null}
        {message ? (
          <span className={`text-sm ${message === "Saved." ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-200"}`}>
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Badge({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div
      title={hint}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
        ok
          ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-zinc-600/50 bg-zinc-900/40 text-zinc-500"
      }`}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </div>
  );
}

type IntegrationStatus = {
  gnews?: boolean;
  fred?: boolean;
  gemini?: boolean;
  openai?: boolean;
  mistral?: boolean;
  elevenlabs?: boolean;
  clerk_publishable?: boolean;
  clerk_secret?: boolean;
  alpaca?: boolean;
  alert_webhook?: boolean;
  zapier_webhook?: boolean;
  smtp_email?: boolean;
  twilio_sms?: boolean;
  twilio_account_sid?: boolean;
  twilio_auth_token?: boolean;
  twilio_from_number?: boolean;
  twilio_alert_to?: boolean;
};

export function Settings() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [s, h] = await Promise.all([api.integrationStatus().catch(() => ({})), api.health().catch(() => ({}))]);
        if (!cancelled) {
          setStatus(s as IntegrationStatus);
          setHealth(h as Health);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load status");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const s = status ?? {};

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Preferences
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Integration badges reflect keys on the FastAPI host (never sent to the browser). Charts and
          “why this matters” need a current backend build.
        </p>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking backend…
        </div>
      )}
      {err && (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          {err} — is the API running at <code className="text-xs">{apiBase}</code>?
        </p>
      )}

      <InvestmentPreferencesSettings />

      <div className="glass rounded-2xl p-6">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Live API</p>
        <p className="mt-1 text-xs text-zinc-500">
          Base URL from env: <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">{apiBase}</code>
        </p>
        {health && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Route build</p>
            <div className="flex flex-wrap gap-2">
              <Badge ok={health.status === "ok"} label="API up" />
              <Badge
                ok={health.market_ohlc === true || health.market_ohlc_api_prefix === true}
                label="Chart /market/ohlc"
                hint="Green if either path exists. Restart uvicorn from C:\\finHACk if both false."
              />
              <Badge ok={health.market_cross_asset === true} label="Cross-asset" />
              <Badge ok={health.ai_explain === true} label="/ai/explain" />
              <Badge ok={health.mistral_key_loaded === true} label="Mistral key (health)" />
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-6">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Backend keys (detected)</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Green means non-empty env var on the server (not a guarantee of quota or plan tier).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge ok={!!s.gnews} label="GNews" />
          <Badge ok={!!s.openai} label="OpenAI" />
          <Badge ok={!!s.mistral} label="Mistral" />
          <Badge ok={!!s.fred} label="FRED" />
          <Badge ok={!!s.gemini} label="Gemini" />
          <Badge ok={!!s.elevenlabs} label="ElevenLabs" />
          <Badge ok={!!s.clerk_publishable} label="Clerk publishable" />
          <Badge ok={!!s.clerk_secret} label="Clerk secret" />
          <Badge ok={!!s.alpaca} label="Alpaca (paper)" />
          <Badge ok={!!(s.alert_webhook ?? s.zapier_webhook)} label="HTTP webhook (optional)" />
          <Badge ok={!!s.smtp_email} label="SMTP email alerts" />
          <Badge ok={!!s.twilio_sms} label="Twilio SMS" />
        </div>
        {!s.twilio_sms && (
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Twilio SMS sends only when all of these are set in the API <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">.env</code>:{" "}
            <code className="text-[11px]">TWILIO_ACCOUNT_SID</code>,{" "}
            <code className="text-[11px]">TWILIO_AUTH_TOKEN</code> (not the Account SID),{" "}
            <code className="text-[11px]">TWILIO_FROM_NUMBER</code> (your Twilio number, E.164), and{" "}
            <code className="text-[11px]">ALERT_SMS_TO</code> (your phone, E.164). Restart uvicorn after edits.
            {!s.twilio_from_number || !s.twilio_alert_to ? (
              <>
                {" "}
                Missing now: {!s.twilio_from_number ? "from-number " : ""}
                {!s.twilio_alert_to ? "ALERT_SMS_TO " : ""}
              </>
            ) : null}
          </p>
        )}
        {!s.mistral && (
          <p className="mt-2 max-w-2xl text-xs text-zinc-500">
            Mistral: set <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">MISTRAL_API_KEY</code> in the API{" "}
            <code className="rounded bg-zinc-200/50 px-1 dark:bg-zinc-800">.env</code> (repo root) and restart the server.
          </p>
        )}
      </div>

      <div className="glass max-w-lg rounded-2xl p-6">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          Appearance
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Toggle between dark and light surfaces. Preference is saved locally.
        </p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </div>

      <div className="glass max-w-lg rounded-2xl p-6">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          Frontend environment
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Point the UI at your FastAPI instance with{" "}
          <code className="rounded bg-zinc-900/10 px-1.5 py-0.5 text-xs dark:bg-white/10">
            VITE_API_URL
          </code>{" "}
          in <code className="text-xs">frontend/.env</code> (default{" "}
          <code className="text-xs">http://127.0.0.1:8000</code>). Restart{" "}
          <code className="text-xs">npm run dev</code> after edits.
        </p>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Clerk: set{" "}
          <code className="rounded bg-zinc-900/10 px-1.5 py-0.5 text-xs dark:bg-white/10">
            VITE_CLERK_PUBLISHABLE_KEY
          </code>{" "}
          to match your Clerk project (same as{" "}
          <code className="text-xs">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> on the API).
        </p>
      </div>

      <NotificationAndDigestSettings />

      <div className="glass max-w-lg rounded-2xl p-6">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          Voice (ElevenLabs)
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Set{" "}
          <code className="rounded bg-zinc-900/10 px-1.5 py-0.5 text-xs dark:bg-white/10">
            ELEVENLABS_API_KEY
          </code>{" "}
          and optionally{" "}
          <code className="rounded bg-zinc-900/10 px-1.5 py-0.5 text-xs dark:bg-white/10">
            ELEVENLABS_VOICE_ID
          </code>{" "}
          on the backend. Free tiers often return HTTP 402 for API library voices; the UI falls back
          to browser read-aloud where implemented.
        </p>
      </div>
    </div>
  );
}
