import { useEffect, useMemo, useState } from "react";
import { Loader2, Mic, Newspaper, Sparkles, TrendingUp } from "lucide-react";
import { api, postAiAudioSummary } from "../lib/api";
import { ClerkUserGate } from "../components/ClerkUserGate";
import { WhyMattersButton } from "../components/WhyMattersSheet";

const DEMO_SENTENCE =
  "Demo mode: set GEMINI_API_KEY or OPENAI_API_KEY for live summaries. This is placeholder insight text for the hackathon UI.";

type CrossAssetPayload = {
  headline?: string;
  ai_narrative?: string;
  chains?: {
    id?: string;
    title?: string;
    when?: string;
    plain?: string;
    links?: { from?: string; direction?: string; to?: string; note?: string }[];
  }[];
  quotes?: { symbol?: string; change_percent?: string }[];
};

function isBackendDemoInsight(text: string): boolean {
  if (text.includes(DEMO_SENTENCE)) return true;
  if (text.includes("Demo mode: set GEMINI_API_KEY for live Gemini summaries")) return true;
  return false;
}

const SHORT_GEMINI_SETUP = `Gemini is not loaded on your API server.

Add one of these to the project root file .env (same folder as app.py), not frontend/.env only:
• GEMINI_API_KEY=…
• GOOGLE_API_KEY=… (AI Studio / GenAI)

Restart Uvicorn from the repo root, then refresh. In Settings, the Gemini integration badge should show on.`;

type AvArticle = {
  title?: string;
  url?: string;
  source?: string;
  summary?: string;
  time_published?: string;
  overall_sentiment_label?: string;
  overall_sentiment_score?: number;
};

type PortfolioPosition = {
  symbol: string;
  risk_score: number;
  beta: number;
  volatility: number;
  weight: number;
};

type PortfolioData = {
  analysis?: string;
  risk_score?: number;
  risk_label?: string;
  positions?: PortfolioPosition[];
  sharpe_ratio?: number | null;
  max_drawdown_pct?: number | null;
  rolling_beta_90d?: number | null;
};

type StrategyData = {
  suggestions?: string;
  regime?: string;
  confidence_pct?: number;
  narrative?: string;
  regime_last_30d?: Record<string, number>;
  fed_rate?: number;
  cpi?: number;
  unemployment?: number;
  pce?: number;
  risk_score?: number;
  risk_label?: string;
};

function normalizeText(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value == null) return "No insight available yet.";
  return String(value);
}

function enrichDemoText(kind: "news" | "strategy"): string {
  if (kind === "news") {
    return `Live AI is currently in demo mode.

What this section will show with Gemini enabled:
- Top market themes from the latest headlines (rates, earnings, AI, energy)
- Bullish vs bearish sentiment balance with confidence-style language
- Plain-English impact on growth, rates, and volatility expectations
- "So what?" lines tying headlines to portfolio sectors you hold

What you can do now:
- Scan headlines for words that move your sectors (semis, banks, consumer)
- Separate one-off news from recurring themes (guidance, labor, inflation)
- Note whether sentiment is reacting to data vs positioning/flows

To enable live output, add GEMINI_API_KEY or OPENAI_API_KEY in your API .env and refresh.`;
  }
  return `Live AI is currently in demo mode.

What this section will show with Gemini enabled:
- Risk-aware trade adjustments and sizing ideas (half-size, scale-in, time stops)
- Entry and exit discipline reminders (plans vs impulses)
- Position-level actions to reduce downside exposure (hedges, trims, correlation)
- Scenario prompts: "If the index drops 5%, what do I do first?"

What you can do now:
- Define max position size as a % of portfolio before the next trade
- For each open idea, write invalidation: "I exit if ___"
- Re-read your last 3 trades: were they process-driven or emotion-driven?

To enable live output, add GEMINI_API_KEY or OPENAI_API_KEY in your API .env and refresh.`;
}

function SentimentBadge({ label }: { label?: string }) {
  if (!label) return null;
  const lower = label.toLowerCase();
  const isBull = lower.includes("bull");
  const isBear = lower.includes("bear");
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide ${
      isBull ? "text-emerald-400" : isBear ? "text-rose-400" : "text-zinc-500"
    }`}>
      {label}
    </span>
  );
}

function RiskBar({ score, label }: { score: number; label: string }) {
  const color =
    label === "Low" ? "bg-emerald-400" :
    label === "Moderate" ? "bg-yellow-400" :
    label === "High" ? "bg-orange-400" : "bg-rose-400";
  const textColor =
    label === "Low" ? "text-emerald-400" :
    label === "Moderate" ? "text-yellow-400" :
    label === "High" ? "text-orange-400" : "text-rose-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Portfolio Risk Score</span>
        <span className={`font-bold ${textColor}`}>{score}/10 — {label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

function PositionRiskRow({ pos }: { pos: PortfolioPosition }) {
  const textColor =
    pos.risk_score < 4 ? "text-emerald-400" :
    pos.risk_score < 6 ? "text-yellow-400" :
    pos.risk_score < 7.5 ? "text-orange-400" : "text-rose-400";

  const volScore = Math.min(pos.volatility * 15, 4).toFixed(1);
  const betaScore = Math.min(Math.abs(pos.beta) * 1.5, 3).toFixed(1);
  const sizeScore = Math.min(pos.weight * 6, 3).toFixed(1);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-200">{pos.symbol}</span>
        <span className={`text-xs font-bold ${textColor}`}>{pos.risk_score}/10</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-500">
            <span>Volatility</span>
            <span className="text-zinc-300">{volScore}/4</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800">
            <div className="h-1 rounded-full bg-blue-400" style={{ width: `${(Number(volScore) / 4) * 100}%` }} />
          </div>
          <span className="text-zinc-500">{(pos.volatility * 100).toFixed(1)}% ann.</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-500">
            <span>Beta</span>
            <span className="text-zinc-300">{betaScore}/3</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800">
            <div className="h-1 rounded-full bg-purple-400" style={{ width: `${(Number(betaScore) / 3) * 100}%` }} />
          </div>
          <span className="text-zinc-500">β {pos.beta.toFixed(2)}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-500">
            <span>Weight</span>
            <span className="text-zinc-300">{sizeScore}/3</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800">
            <div className="h-1 rounded-full bg-amber-400" style={{ width: `${(Number(sizeScore) / 3) * 100}%` }} />
          </div>
          <span className="text-zinc-500">{(pos.weight * 100).toFixed(1)}% of port.</span>
        </div>
      </div>
    </div>
  );
}

function FormattedInsight({ text, kind }: { text: string; kind?: string }) {
  const lines = text.split("\n").filter(Boolean);

  return (
    <div className="mt-4 space-y-3">
      {lines.map((line, i) => {
        const clean = line
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\*(.+?)\*/g, "$1")
          .trim();

        const isHeader = /^(TOP THEMES|SENTIMENT BALANCE|MACRO IMPACT|SO WHAT)/i.test(clean);
        const isBullet = /^[-•]\s/.test(clean);
        const isNumbered = /^\d+\.\s/.test(clean);

        if (isHeader) {
          return (
            <p key={i} className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 mt-4 first:mt-0">
              {clean}
            </p>
          );
        }

        if (isBullet) {
          return (
            <div key={i} className="flex gap-2 text-sm text-zinc-300 leading-relaxed">
              <span className="text-zinc-500 shrink-0 mt-0.5">·</span>
              <span>{clean.replace(/^[-•]\s/, "")}</span>
            </div>
          );
        }

        if (isNumbered && kind === "strategy") {
          const num = clean.match(/^(\d+)\./)?.[1];
          const rest = clean.replace(/^\d+\.\s*/, "");
          const colonIdx = rest.indexOf(":");
          const title = colonIdx > -1 ? rest.slice(0, colonIdx) : rest;
          const body = colonIdx > -1 ? rest.slice(colonIdx + 1).trim() : "";

          return (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                  {num}
                </span>
                <span className="text-sm font-semibold text-zinc-100">{title}</span>
              </div>
              {body && (
                <p className="text-xs leading-relaxed text-zinc-400 pl-7">{body}</p>
              )}
            </div>
          );
        }

        if (isNumbered) {
          const num = clean.match(/^(\d+)\./)?.[1];
          const rest = clean.replace(/^\d+\.\s/, "");
          return (
            <div key={i} className="flex gap-2 text-sm text-zinc-300 leading-relaxed">
              <span className="text-blue-400 font-semibold shrink-0">{num}.</span>
              <span>{rest}</span>
            </div>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed text-zinc-400">
            {clean}
          </p>
        );
      })}
    </div>
  );
}

function InsightsContent({ userId }: { userId: string }) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [news, setNews] = useState<unknown>(null);
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [crossAsset, setCrossAsset] = useState<CrossAssetPayload | null>(null);

  const [newsTicker, setNewsTicker] = useState("SPY");
  const [newsFeed, setNewsFeed] = useState<{
    symbol?: string;
    avg_sentiment?: number;
    articles?: AvArticle[];
    article_count?: number;
    error?: string;
    api_message?: string;
  } | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsErr, setNewsErr] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<{ gemini?: boolean } | null>(null);
  const [heldSymbols, setHeldSymbols] = useState<string[]>([]);
  const [holdingsNews, setHoldingsNews] = useState<Record<string, AvArticle[]>>({});
  const [holdingsNewsLoading, setHoldingsNewsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.integrationStatus()
      .then((s) => { if (!cancelled) setIntegrations(s); })
      .catch(() => { if (!cancelled) setIntegrations(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = (await api.marketCrossAsset()) as CrossAssetPayload;
        if (!cancelled) setCrossAsset(c);
      } catch {
        if (!cancelled) setCrossAsset(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.holdingsSnapshot(userId)
      .then((s) => {
        if (cancelled) return;
        const rows = ((s as { positions?: { symbol?: string }[] }).positions ?? [])
          .map((p) => String(p.symbol ?? "").toUpperCase().trim())
          .filter(Boolean);
        setHeldSymbols(rows.slice(0, 8));
      })
      .catch(() => { if (!cancelled) setHeldSymbols([]); });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (heldSymbols.length === 0) return;
    let cancelled = false;
    (async () => {
      setHoldingsNewsLoading(true);
      const results: Record<string, AvArticle[]> = {};
      await Promise.all(
        heldSymbols.slice(0, 6).map(async (ticker) => {
          try {
            const r = await api.marketNews(ticker, 5) as { articles?: AvArticle[] };
            if (!cancelled) results[ticker] = r.articles?.slice(0, 3) ?? [];
          } catch {
            if (!cancelled) results[ticker] = [];
          }
        })
      );
      if (!cancelled) {
        setHoldingsNews(results);
        setHoldingsNewsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [heldSymbols]);

  useEffect(() => {
    let ax = false;
    const manual = newsTicker.trim().toUpperCase();
    const sym = manual || (heldSymbols.length > 0 ? heldSymbols.slice(0, 4).join(",") : "SPY");
    (async () => {
      setNewsLoading(true);
      setNewsErr(null);
      try {
        const r = await api.marketNews(sym, 12);
        if (!ax) setNewsFeed(r as typeof newsFeed);
      } catch (e) {
        if (!ax) {
          setNewsErr(e instanceof Error ? e.message : "News load failed");
          setNewsFeed(null);
        }
      } finally {
        if (!ax) setNewsLoading(false);
      }
    })();
    return () => { ax = true; };
  }, [newsTicker, heldSymbols]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [p, n, s] = await Promise.all([
          api.aiPortfolioAnalysis(userId),
          api.aiNewsSummary(userId),
          api.aiStrategy(userId),
        ]);
        if (!cancelled) {
          setPortfolio(p as PortfolioData);
          setNews(n);
          setStrategy(s as StrategyData);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const sections = useMemo(() => {
    const portfolioText = normalizeText(portfolio?.analysis);
    const newsText =
      typeof news === "object" && news && "summary" in news
        ? normalizeText((news as { summary?: unknown }).summary)
        : normalizeText(news);
    const strategyText = normalizeText(strategy?.suggestions);
    const geminiOff = integrations?.gemini === false;

    return [
      {
        key: "portfolio",
        title: "Portfolio analysis",
        text: isBackendDemoInsight(portfolioText) ? "" : portfolioText,
        placeholder: isBackendDemoInsight(portfolioText),
      },
      {
        key: "news",
        title: "News sentiment",
        text: isBackendDemoInsight(newsText)
          ? geminiOff ? SHORT_GEMINI_SETUP : enrichDemoText("news")
          : newsText,
        placeholder: isBackendDemoInsight(newsText),
      },
      {
        key: "strategy",
        title: "Strategy suggestions",
        text: isBackendDemoInsight(strategyText)
          ? geminiOff ? SHORT_GEMINI_SETUP : enrichDemoText("strategy")
          : strategyText,
        placeholder: isBackendDemoInsight(strategyText),
      },
    ];
  }, [portfolio, news, strategy, integrations]);

  async function playCombinedAudio() {
    setAudioBusy(true);
    const text = sections.map((x) => `${x.title}: ${x.text}`).join("\n\n");
    try {
      const blob = await postAiAudioSummary({ text: text.slice(0, 4500) });
      const url = URL.createObjectURL(blob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);
    } catch {
      const spoken = text.slice(0, 3800) + ". End of summary. ElevenLabs MP3 was unavailable; this was browser speech.";
      const u = new SpeechSynthesisUtterance(spoken);
      window.speechSynthesis.speak(u);
    } finally {
      setAudioBusy(false);
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Holdings News Section ── */}
      <section className="glass rounded-2xl border border-blue-500/20 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">News for your positions</h2>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              Live
            </span>
          </div>
          {heldSymbols.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {heldSymbols.map((t) => (
                <span key={t} className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-300">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {holdingsNewsLoading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Fetching headlines for your holdings…
          </div>
        )}
        {!holdingsNewsLoading && heldSymbols.length === 0 && (
          <p className="text-sm text-zinc-500">No holdings found. Add positions to see relevant headlines here.</p>
        )}
        {!holdingsNewsLoading && heldSymbols.length > 0 && (
          <div className="space-y-7">
            {heldSymbols.slice(0, 6).map((ticker) => {
              const articles = holdingsNews[ticker] ?? [];
              return (
                <div key={ticker}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{ticker}</span>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>
                  {articles.length === 0 ? (
                    <p className="text-xs text-zinc-500">No headlines found for {ticker}.</p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {articles.map((a, i) => (
                        <li key={`${a.url ?? i}-${i}`} className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                          <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer"
                            className="line-clamp-3 text-sm font-medium leading-snug text-zinc-100 hover:underline underline-offset-2">
                            {a.title ?? "Untitled"}
                          </a>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500 mt-auto">
                            {a.source && <span className="truncate">{a.source}</span>}
                            {a.time_published && <span className="tabular-nums shrink-0">{a.time_published.slice(0, 10)}</span>}
                            <SentimentBadge label={a.overall_sentiment_label} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Chain Reactions Section ── */}
      <section className="glass rounded-2xl border border-amber-500/20 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-500/90">
              Chain reactions · cross-asset engine
            </h2>
          </div>
          <WhyMattersButton
            label="Why chains?"
            context={{
              kind: "chain",
              label: "Oil, ethanol, soybeans, USD, rates",
              value: crossAsset?.headline ?? "",
              user_note: crossAsset?.ai_narrative ?? "",
            }}
          />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {crossAsset?.headline ?? "Link second-order effects: cheaper oil can reshape ethanol economics while fertilizer and weather drive row-crop supply on another track."}
        </p>
        {crossAsset?.ai_narrative && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{crossAsset.ai_narrative}</p>
        )}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(crossAsset?.chains ?? []).map((ch) => (
            <div key={ch.id ?? ch.title} className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500/90">{ch.title}</p>
              <p className="mt-2 text-[11px] text-zinc-500">{ch.when}</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {(ch.links ?? []).map((ln, i) => (
                  <li key={i} className="flex flex-wrap gap-x-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{ln.from}</span>
                    <span className="text-zinc-500">{ln.direction}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{ln.to}</span>
                    <span className="text-zinc-500">— {ln.note}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{ch.plain}</p>
            </div>
          ))}
        </div>
        {crossAsset?.quotes && crossAsset.quotes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-500">
            Snapshot:
            {crossAsset.quotes.map((qq) => (
              <span key={qq.symbol} className="rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-800">
                {qq.symbol} {qq.change_percent != null ? `${qq.change_percent}%` : ""}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Page Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Insights</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            AI research support &amp; strategy framing
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Headlines from GNews and Yahoo, plus LLM panels (Gemini/OpenAI) for portfolio, news, and paper-lab strategy —
            aligned with <strong className="font-medium text-zinc-600 dark:text-zinc-400">investment research</strong>{" "}
            support; combine with <strong className="font-medium text-zinc-600 dark:text-zinc-400">Learn Hub</strong> for
            education. Not personalized advice.
          </p>
        </div>
        <button
          type="button"
          onClick={playCombinedAudio}
          disabled={audioBusy || loading}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          {audioBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
          Play AI audio
        </button>
      </header>

      {/* ── Market News Feed ── */}
      <section className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Market news feed</h2>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200">
              GNews + Yahoo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="ins-news-ticker" className="text-xs text-zinc-500">Tickers</label>
            <input
              id="ins-news-ticker"
              className="w-32 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm uppercase text-white dark:bg-zinc-900/80"
              value={newsTicker}
              onChange={(e) => setNewsTicker(e.target.value.toUpperCase())}
              placeholder={heldSymbols.length > 0 ? heldSymbols.slice(0, 3).join(",") : "SPY"}
              maxLength={24}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Uses <code className="rounded bg-zinc-800 px-1">GNews</code> (with{" "}
          <code className="rounded bg-zinc-800 px-1">GNEWS_API_KEY</code>) plus Yahoo headlines. Enter
          one or more tickers (e.g. SPY or SPY,NVDA) to bias the search. Blank defaults to your holdings.
        </p>
        {newsLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading headlines…
          </div>
        )}
        {newsErr && <p className="mt-4 text-sm text-amber-600 dark:text-amber-300">{newsErr}</p>}
        {!newsLoading && newsFeed?.error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {newsFeed.error}
          </p>
        )}
        {!newsLoading && newsFeed?.api_message && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
            {newsFeed.api_message}
          </p>
        )}
        {!newsLoading && newsFeed && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-zinc-700 bg-zinc-900/40 px-3 py-1 text-zinc-200">
                Avg sentiment:{" "}
                {typeof newsFeed.avg_sentiment === "number" ? newsFeed.avg_sentiment.toFixed(3) : "—"}
              </span>
              <span className="text-zinc-500">
                {newsFeed.article_count ?? newsFeed.articles?.length ?? 0} articles
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(newsFeed.articles ?? []).slice(0, 6).map((a, i) => (
                <li key={`${a.url ?? i}-${i}`} className="flex h-full min-h-[8rem] flex-row gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                  <div className="min-w-0 flex-1">
                    <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer"
                      className="line-clamp-3 text-sm font-medium leading-snug text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-100">
                      {a.title ?? "Untitled"}
                    </a>
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-zinc-500">
                      {a.source && <span className="truncate">{a.source}</span>}
                      {a.time_published && <span className="shrink-0 tabular-nums">{a.time_published.slice(0, 10)}</span>}
                      {a.overall_sentiment_score != null && (
                        <span className="tabular-nums">s {Number(a.overall_sentiment_score).toFixed(2)}</span>
                      )}
                    </div>
                    {a.summary && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{a.summary}</p>
                    )}
                  </div>
                  {a.overall_sentiment_label && (
                    <div className="flex w-20 shrink-0 flex-col items-end justify-start border-l border-zinc-800/80 pl-2 sm:w-24 sm:pl-3">
                      <SentimentBadge label={a.overall_sentiment_label} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading insight panels…
        </div>
      )}
      {err && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-2 text-sm text-amber-800 dark:text-amber-100">
          {err}
        </p>
      )}
      {integrations?.gemini === false && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/25 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            AI insight panels are in demo until Gemini is configured
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-800/90 dark:text-amber-100/90">
            Add <code className="rounded bg-black/10 px-1 dark:bg-white/10">GEMINI_API_KEY</code> or{" "}
            <code className="rounded bg-black/10 px-1 dark:bg-white/10">GOOGLE_API_KEY</code> to{" "}
            <code className="rounded bg-black/10 px-1 dark:bg-white/10">.env</code> in the project root, restart Uvicorn, and reload.
          </p>
        </div>
      )}
      {audioUrl && <audio controls src={audioUrl} className="w-full max-w-md" />}

      {/* ── Insight Panels ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {sections.map(({ key, title, text, placeholder }) => (
          <div key={key} className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>

            {/* Portfolio risk score UI */}
            {key === "portfolio" && portfolio?.risk_score != null && (
              <div className="mt-4 space-y-3">
                <RiskBar score={portfolio.risk_score} label={portfolio.risk_label ?? "Unknown"} />
                <div className="mt-3 space-y-1.5">
                  {(portfolio.positions ?? []).map((pos) => (
                    <PositionRiskRow key={pos.symbol} pos={pos} />
                  ))}
                </div>
                {/* Portfolio-level metrics */}
                {(portfolio.sharpe_ratio != null || portfolio.max_drawdown_pct != null || portfolio.rolling_beta_90d != null) && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-3">
                    <div className="space-y-1 text-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Sharpe Ratio</p>
                      <p className={`text-lg font-bold ${
                        portfolio.sharpe_ratio == null ? "text-zinc-500" :
                        portfolio.sharpe_ratio >= 1 ? "text-emerald-400" :
                        portfolio.sharpe_ratio >= 0 ? "text-yellow-400" : "text-rose-400"
                      }`}>
                        {portfolio.sharpe_ratio != null ? portfolio.sharpe_ratio.toFixed(2) : "—"}
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {portfolio.sharpe_ratio == null ? "" :
                         portfolio.sharpe_ratio >= 1 ? "Good" :
                         portfolio.sharpe_ratio >= 0 ? "Moderate" : "Poor"}
                      </p>
                    </div>
                    <div className="space-y-1 text-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Max Drawdown</p>
                      <p className={`text-lg font-bold ${
                        portfolio.max_drawdown_pct == null ? "text-zinc-500" :
                        portfolio.max_drawdown_pct > -10 ? "text-emerald-400" :
                        portfolio.max_drawdown_pct > -20 ? "text-yellow-400" : "text-rose-400"
                      }`}>
                        {portfolio.max_drawdown_pct != null ? `${portfolio.max_drawdown_pct.toFixed(1)}%` : "—"}
                      </p>
                      <p className="text-[10px] text-zinc-600">1-year low</p>
                    </div>
                    <div className="space-y-1 text-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Rolling Beta</p>
                      <p className={`text-lg font-bold ${
                        portfolio.rolling_beta_90d == null ? "text-zinc-500" :
                        Math.abs(portfolio.rolling_beta_90d) < 0.8 ? "text-emerald-400" :
                        Math.abs(portfolio.rolling_beta_90d) < 1.2 ? "text-yellow-400" : "text-rose-400"
                      }`}>
                        {portfolio.rolling_beta_90d != null ? portfolio.rolling_beta_90d.toFixed(2) : "—"}
                      </p>
                      <p className="text-[10px] text-zinc-600">90-day vs SPY</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {key === "portfolio" && portfolio?.risk_score == null && (
              <p className="mt-4 text-sm text-zinc-500">Add positions to see your risk score.</p>
            )}

            {/* Strategy regime context */}
            {key === "strategy" && strategy?.regime && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Market Regime</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    strategy.regime === "Bull"
                      ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
                      : strategy.regime === "Bear"
                        ? "bg-rose-400/10 text-rose-400 border border-rose-400/30"
                        : "bg-yellow-400/10 text-yellow-400 border border-yellow-400/30"
                  }`}>
                    {strategy.regime} · {strategy.confidence_pct}% confidence
                  </span>
                </div>
                {strategy.narrative && (
                  <p className="text-xs text-zinc-400 leading-relaxed">{strategy.narrative}</p>
                )}
                {strategy.regime_last_30d && Object.keys(strategy.regime_last_30d).length > 0 && (
                  <div className="flex gap-3 text-[10px]">
                    {Object.entries(strategy.regime_last_30d).map(([label, days]) => (
                      <div key={label} className="flex items-center gap-1">
                        <span className={`font-semibold ${
                          label === "Bull" ? "text-emerald-400" :
                          label === "Bear" ? "text-rose-400" : "text-yellow-400"
                        }`}>{label}</span>
                        <span className="text-zinc-500">{days}d</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {strategy.fed_rate != null && (
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-400">
                      Fed {strategy.fed_rate}%
                    </span>
                  )}
                  {strategy.cpi != null && (
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-400">
                      CPI {strategy.cpi}
                    </span>
                  )}
                  {strategy.unemployment != null && (
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-400">
                      Unemployment {strategy.unemployment}%
                    </span>
                  )}
                  {strategy.pce != null && (
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-400">
                      PCE {strategy.pce.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="h-px bg-zinc-800" />
              </div>
            )}

            {key !== "portfolio" && placeholder && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-800 dark:text-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                {integrations?.gemini === false ? "Setup: add API key" : "Demo mode"}
              </div>
            )}

            {text ? <FormattedInsight text={text} kind={key} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Insights() {
  return (
    <ClerkUserGate>
      {(userId) => <InsightsContent userId={userId} />}
    </ClerkUserGate>
  );
}