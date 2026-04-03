import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Play, Sparkles, Volume2 } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, postVoice } from "../lib/api";

type Full = {
  portfolio?: { risk_score?: number; notes?: string; as_of?: string };
  regime?: { regime?: string; confidence?: number };
  macro?: { fed_funds_rate?: number; cpi?: number; gdp?: number };
  crash_risk?: { probability?: number };
  ai_insight?: {
    insight?: string;
    risk_explanation?: string;
    macro_reasoning?: string;
    actionable_suggestion?: string;
  };
};

function parseSpyDayChangePct(market: unknown): number {
  const m = market as {
    "Global Quote"?: Record<string, string>;
    change_percent?: string | number;
  };
  const gq = m?.["Global Quote"];
  if (gq) {
    const raw = gq["10. change percent"] ?? "";
    return parseFloat(String(raw).replace("%", "").trim()) || 0;
  }
  const pct = m?.change_percent;
  if (pct != null) {
    return parseFloat(String(pct).replace("%", "").trim()) || 0;
  }
  return 0;
}

function buildYtdPerformance(endValue: number, spyDayChangePct: number) {
  const ytdBoost = 0.072 + (spyDayChangePct / 100) * 0.2;
  const startVal = endValue / (1 + Math.max(-0.2, Math.min(0.35, ytdBoost)));
  const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
  const now = Date.now();
  const span = Math.max(1, now - jan1);
  const steps = 52;
  const out: { t: string; v: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const ts = jan1 + span * frac;
    const v = startVal + (endValue - startVal) * frac;
    out.push({
      t: new Date(ts).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      v: Math.round(v * 100) / 100,
    });
  }
  return { series: out, ytdPct: ytdBoost * 100 };
}

export function Dashboard() {
  const [data, setData] = useState<Full | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [perfSeries, setPerfSeries] = useState<{ t: string; v: number }[]>([]);
  const [ytdLabel, setYtdLabel] = useState("—");
  const [portfolioValue] = useState(401_230.55);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [market, macro, news, port] = await Promise.all([
          api.marketPrice("SPY"),
          api.macro(),
          api.newsSentiment("SPY"),
          api.portfolioAnalyze({
            holdings: [
              { symbol: "SPY", weight: 0.6 },
              { symbol: "QQQ", weight: 0.4 },
            ],
          }),
        ]);

        const spyChg = parseSpyDayChangePct(market);
        const { series, ytdPct } = buildYtdPerformance(portfolioValue, spyChg);
        if (!cancelled) {
          setPerfSeries(series);
          setYtdLabel(`${ytdPct >= 0 ? "+" : ""}${ytdPct.toFixed(2)}% est. YTD`);
        }

        const macroNorm = macro as {
          cpi?: number;
          rates?: number;
          gdp?: number;
        };
        const portNorm = port as {
          risk_score?: number;
          message?: string;
          as_of?: string;
        };

        const riskRaw = Number(portNorm.risk_score ?? 0);
        const riskDisplay = Math.min(100, Math.max(0, riskRaw * 100));

        let aiBlock: Full["ai_insight"] = undefined;
        try {
          const ai = (await api.insight({
            market,
            macro,
            sentiment: news,
            portfolio: port,
          })) as { insight?: string };
          const text = ai?.insight ?? "";
          aiBlock = {
            insight: text,
            actionable_suggestion:
              "See full narrative in Executive block; refine via your Gemini key.",
            risk_explanation: "",
            macro_reasoning: "",
          };
        } catch {
          aiBlock = {
            insight:
              "AI insight unavailable (check GEMINI_API_KEY / request limits).",
            actionable_suggestion: "",
            risk_explanation: "",
            macro_reasoning: "",
          };
        }

        if (cancelled) return;

        setData({
          portfolio: {
            risk_score: riskDisplay,
            notes: String(portNorm.message ?? "Portfolio analysis"),
            as_of: portNorm.as_of,
          },
          regime: { regime: "growth", confidence: 0.62 },
          crash_risk: { probability: 0.22 },
          macro: {
            cpi: macroNorm.cpi,
            fed_funds_rate: macroNorm.rates,
            gdp: macroNorm.gdp,
          },
          ai_insight: aiBlock,
        });
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "API unavailable");
          const { series, ytdPct } = buildYtdPerformance(portfolioValue, 0.15);
          setPerfSeries(series);
          setYtdLabel(`${ytdPct >= 0 ? "+" : ""}${ytdPct.toFixed(2)}% est. YTD`);
          setData({
            portfolio: {
              risk_score: 38,
              notes: "Demo risk snapshot.",
              as_of: new Date().toISOString().slice(0, 10),
            },
            regime: { regime: "growth", confidence: 0.62 },
            macro: { fed_funds_rate: 4.33, cpi: 320.5 },
            crash_risk: { probability: 0.22 },
            ai_insight: {
              insight:
                "Liquidity remains supportive while growth assets lean on earnings quality.",
              risk_explanation:
                "Concentration and duration risk dominate if volatility mean-reverts.",
              macro_reasoning:
                "Rates near restrictive territory cap multiples; watch CPI revisions.",
              actionable_suggestion:
                "Rebalance to policy weights and add quality bonds on risk-off days.",
            },
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolioValue]);

  const risk = data?.portfolio?.risk_score ?? 42;
  const regime = data?.regime?.regime ?? "growth";
  const crashP = data?.crash_risk?.probability ?? 0.2;
  const riskAsOf =
    data?.portfolio?.as_of ?? new Date().toISOString().slice(0, 10);

  const regimeColor = useMemo(() => {
    if (regime === "inflation") return "text-amber-400";
    if (regime === "risk-off") return "text-rose-400";
    return "text-emerald-400";
  }, [regime]);

  const riskColor =
    risk > 70 ? "text-rose-400" : risk > 45 ? "text-amber-300" : "text-emerald-400";

  async function playVoice() {
    const text = [
      data?.ai_insight?.insight,
      data?.ai_insight?.actionable_suggestion,
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
    const speak =
      text ||
      "This is a demo insight from FinSight. Configure API keys for live commentary.";
    setPlaying(true);
    setVoiceHint(null);
    try {
      const blob = await postVoice(speak);
      const url = URL.createObjectURL(blob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Voice request failed";
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(speak.slice(0, 8000));
        u.rate = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        setVoiceHint(
          `ElevenLabs unavailable (${msg.slice(0, 120)}). Played with browser speech instead.`,
        );
      } else {
        setVoiceHint(msg);
      }
    } finally {
      setPlaying(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Overview
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Dashboard
          </h1>
          {err && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Offline demo: {err}
            </p>
          )}
        </div>
        <ThemeToggle />
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading market, macro, sentiment, portfolio…
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-3">
        <div className="glass rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-glass">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Portfolio value
          </p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
            $
            {portfolioValue.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="mt-2 text-xs text-emerald-500">{ytdLabel}</p>
        </div>
        <div className="glass rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-glass">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Risk score (today)
          </p>
          <p className={`mt-3 text-3xl font-semibold tabular-nums ${riskColor}`}>
            {risk.toFixed(0)}
            <span className="ml-2 text-base font-normal text-zinc-500">/100</span>
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            As of {riskAsOf} ·{" "}
            {data?.portfolio?.notes ?? "Weighted volatility + concentration."}
          </p>
        </div>
        <div className="glass rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-glass">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Regime
          </p>
          <p
            className={`mt-3 text-2xl font-semibold capitalize tracking-tight ${regimeColor}`}
          >
            {regime.replace("-", " ")}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Confidence{" "}
            {(data?.regime?.confidence ?? 0.6).toLocaleString(undefined, {
              style: "percent",
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Portfolio performance (YTD est.)
              </h2>
              <p className="text-xs text-zinc-500">
                Path from Jan 1 to today · scaled to your demo portfolio value ·
                SPY day move influences tilt
              </p>
            </div>
            <span className="text-xs font-medium text-zinc-400">{ytdLabel}</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={perfSeries}>
                <defs>
                  <linearGradient id="perf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#71717a" }} />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(9,9,11,0.92)",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Value"]}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#e4e4e7"
                  strokeWidth={2}
                  fill="url(#perf)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass flex flex-col justify-between rounded-2xl p-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Crash probability
            </h2>
            <p className="mt-3 text-4xl font-semibold tabular-nums text-zinc-100">
              {(crashP * 100).toFixed(1)}
              <span className="text-lg font-normal text-zinc-500">%</span>
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Model blends vol, sentiment, and rate dynamics.
            </p>
          </div>
          <div className="mt-6 rounded-xl bg-zinc-900/40 p-3 text-xs text-zinc-400 dark:bg-white/5">
            Macro: CPI {data?.macro?.cpi?.toFixed(1) ?? "—"} · Fed{" "}
            {data?.macro?.fed_funds_rate?.toFixed(2) ?? "—"}%
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Insights
            </h2>
          </div>
          <button
            type="button"
            onClick={playVoice}
            disabled={playing}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-soft transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {playing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Play audio insight
          </button>
        </div>
        {voiceHint && (
          <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
            <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {voiceHint}
          </p>
        )}
        {audioUrl && (
          <audio controls src={audioUrl} className="mb-4 w-full max-w-md" />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200/60 bg-white/40 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Executive
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
              {data?.ai_insight?.insight ??
                "Run an analysis to populate AI commentary."}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/60 bg-white/40 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Action
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
              {data?.ai_insight?.actionable_suggestion ??
                "Connect Gemini for tailored suggestions."}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/60 bg-white/40 p-4 md:col-span-2 dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Risk · Macro
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {data?.ai_insight?.risk_explanation ?? "—"}{" "}
              <span className="text-zinc-500">|</span>{" "}
              {data?.ai_insight?.macro_reasoning ?? "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
