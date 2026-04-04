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

/** Matches current and older API demo strings so panels don't show raw placeholder text. */
function isBackendDemoInsight(text: string): boolean {
  if (text.includes(DEMO_SENTENCE)) return true;
  if (text.includes("Demo mode: set GEMINI_API_KEY for live Gemini summaries")) return true;
  return false;
}

const SHORT_GEMINI_SETUP = `Gemini is not loaded on your API server.

Add one of these to the project root file .env (same folder as app.py), not frontend/.env only:
• GEMINI_API_KEY=…
• GOOGLE_API_KEY=… (AI Studio / GenAI)

Restart Uvicorn from c:\\finHACk (or your repo root), then refresh. In Settings, the Gemini integration badge should show on.

Common mistake: running uvicorn from another folder used to skip .env — that is fixed in the latest app.py; still ensure the key is in the root .env.`;

type AvArticle = {
  title?: string;
  url?: string;
  source?: string;
  summary?: string;
  time_published?: string;
  overall_sentiment_label?: string;
  overall_sentiment_score?: number;
};

function normalizeText(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value == null) return "No insight available yet.";
  return String(value);
}

function enrichDemoText(kind: "portfolio" | "news" | "strategy"): string {
  if (kind === "portfolio") {
    return `Live AI is currently in demo mode.

What this section will show with Gemini enabled:
- Concentration risk by position and sector (e.g. % of equity in top 3 names)
- Diversification score with hedge suggestions (index, sector ETFs, duration)
- 3 clear next actions for sizing and risk control (trim/add, stops, rebalance)
- Plain-language read on beta vs your benchmark and drawdown sensitivity

What you can do now (no API key):
- List your largest positions and ask whether any single name is >20–25% of equity
- Match each holding to a risk bucket: growth, value, defensive, speculative
- Write down one rule: max loss per trade or max sector weight you will accept
- Open Insights → "Chain reactions" to practice second-order thinking (e.g. oil ↔ ethanol ↔ row crops)

To enable live output, add GEMINI_API_KEY or OPENAI_API_KEY in your API .env and refresh.`;
  }
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
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide ${
        isBull
          ? "text-emerald-400"
          : isBear
            ? "text-rose-400"
            : "text-zinc-500"
      }`}
    >
      {label}
    </span>
  );
}

function InsightsContent({ userId }: { userId: string }) {
  const [portfolio, setPortfolio] = useState<unknown>(null);
  const [news, setNews] = useState<unknown>(null);
  const [strategy, setStrategy] = useState<unknown>(null);
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

  // Holdings news state
  const [holdingsNews, setHoldingsNews] = useState<Record<string, AvArticle[]>>({});
  const [holdingsNewsLoading, setHoldingsNewsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .integrationStatus()
      .then((s) => {
        if (!cancelled) setIntegrations(s);
      })
      .catch(() => {
        if (!cancelled) setIntegrations(null);
      });
    return () => {
      cancelled = true;
    };
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .holdingsSnapshot(userId)
      .then((s) => {
        if (cancelled) return;
        const rows = ((s as { positions?: { symbol?: string }[] }).positions ?? [])
          .map((p) => String(p.symbol ?? "").toUpperCase().trim())
          .filter(Boolean);
        setHeldSymbols(rows.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setHeldSymbols([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Fetch news per held ticker
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
    } catch (e) {
      console.error(`Error fetching news for ${ticker}:`, e);
      if (!cancelled) results[ticker] = [];
    }
  })
);
      if (!cancelled) {
        setHoldingsNews(results);
        setHoldingsNewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    return () => {
      ax = true;
    };
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
          setPortfolio(p);
          setNews(n);
          setStrategy(s);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const sections = useMemo(() => {
    const portfolioText =
      typeof portfolio === "object" && portfolio && "analysis" in portfolio
        ? normalizeText((portfolio as { analysis?: unknown }).analysis)
        : normalizeText(portfolio);
    const newsText =
      typeof news === "object" && news && "summary" in news
        ? normalizeText((news as { summary?: unknown }).summary)
        : normalizeText(news);
    const strategyText =
      typeof strategy === "object" && strategy && "suggestions" in strategy
        ? normalizeText((strategy as { suggestions?: unknown }).suggestions)
        : normalizeText(strategy);

    const geminiOff = integrations?.gemini === false;
    const pick = (raw: string, kind: "portfolio" | "news" | "strategy") => {
      if (!isBackendDemoInsight(raw)) return raw;
      if (geminiOff) return SHORT_GEMINI_SETUP;
      return enrichDemoText(kind);
    };

    return [
      {
        key: "portfolio",
        title: "Portfolio analysis",
        text: pick(portfolioText, "portfolio"),
        placeholder: isBackendDemoInsight(portfolioText),
      },
      {
        key: "news",
        title: "News sentiment",
        text: pick(newsText, "news"),
        placeholder: isBackendDemoInsight(newsText),
      },
      {
        key: "strategy",
        title: "Strategy suggestions",
        text: pick(strategyText, "strategy"),
        placeholder: isBackendDemoInsight(strategyText),
      },
    ];
  }, [portfolio, news, strategy, integrations]);

  async function playCombinedAudio() {
    setAudioBusy(true);
    const text = sections.map((x) => `${x.title}: ${x.text}`).join("\n\n");
    try {
      const blob = await postAiAudioSummary({
        text: text.slice(0, 4500),
      });
      const url = URL.createObjectURL(blob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);
    } catch {
      const spoken =
        text.slice(0, 3800) +
        ". End of summary. ElevenLabs MP3 was unavailable; this was browser speech. " +
        "Configure ELEVENLABS_API_KEY on the API with a plan that allows TTS, or keep using read aloud.";
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
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              News for your positions
            </h2>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              Live
            </span>
          </div>
          {heldSymbols.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {heldSymbols.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-300"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {holdingsNewsLoading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching headlines for your holdings…
          </div>
        )}

        {!holdingsNewsLoading && heldSymbols.length === 0 && (
          <p className="text-sm text-zinc-500">
            No holdings found. Add positions to see relevant headlines here.
          </p>
        )}

        {!holdingsNewsLoading && heldSymbols.length > 0 && (
          <div className="space-y-7">
            {heldSymbols.slice(0, 6).map((ticker) => {
              const articles = holdingsNews[ticker] ?? [];
              return (
                <div key={ticker}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                      {ticker}
                    </span>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>
                  {articles.length === 0 ? (
                    <p className="text-xs text-zinc-500">No headlines found for {ticker}.</p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {articles.map((a, i) => (
                        <li
                          key={`${a.url ?? i}-${i}`}
                          className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
                        >
                          <a
                            href={a.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-3 text-sm font-medium leading-snug text-zinc-100 hover:underline underline-offset-2"
                          >
                            {a.title ?? "Untitled"}
                          </a>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500 mt-auto">
                            {a.source && <span className="truncate">{a.source}</span>}
                            {a.time_published && (
                              <span className="tabular-nums shrink-0">
                                {a.time_published.slice(0, 10)}
                              </span>
                            )}
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
          {crossAsset?.headline ??
            "Link second-order effects: cheaper oil can reshape ethanol economics while fertilizer and weather drive row-crop supply on another track."}
        </p>
        {crossAsset?.ai_narrative && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{crossAsset.ai_narrative}</p>
        )}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(crossAsset?.chains ?? []).map((ch) => (
            <div
              key={ch.id ?? ch.title}
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500/90">
                {ch.title}
              </p>
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
              <span
                key={qq.symbol}
                className="rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-800"
              >
                {qq.symbol} {qq.change_percent != null ? `${qq.change_percent}%` : ""}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Page Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Insights
          </p>
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
          {audioBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          Play AI audio
        </button>
      </header>

      {/* ── Market News Feed ── */}
      <section className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Market news feed
            </h2>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200">
              GNews + Yahoo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="ins-news-ticker" className="text-xs text-zinc-500">
              Tickers
            </label>
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
        {newsErr && (
          <p className="mt-4 text-sm text-amber-600 dark:text-amber-300">{newsErr}</p>
        )}

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
                <li
                  key={`${a.url ?? i}-${i}`}
                  className="flex h-full min-h-[8rem] flex-row gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 dark:bg-zinc-900/30"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={a.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-3 text-sm font-medium leading-snug text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {a.title ?? "Untitled"}
                    </a>
                    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-zinc-500">
                      {a.source && <span className="truncate">{a.source}</span>}
                      {a.time_published && (
                        <span className="shrink-0 tabular-nums">{a.time_published.slice(0, 10)}</span>
                      )}
                      {a.overall_sentiment_score != null && (
                        <span className="tabular-nums">s {Number(a.overall_sentiment_score).toFixed(2)}</span>
                      )}
                    </div>
                    {a.summary ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {a.summary}
                      </p>
                    ) : null}
                  </div>
                  {a.overall_sentiment_label ? (
                    <div className="flex w-20 shrink-0 flex-col items-end justify-start border-l border-zinc-800/80 pl-2 sm:w-24 sm:pl-3">
                      <SentimentBadge label={a.overall_sentiment_label} />
                    </div>
                  ) : null}
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
            The API reports no Gemini key. Add{" "}
            <code className="rounded bg-black/10 px-1 dark:bg-white/10">GEMINI_API_KEY</code> or{" "}
            <code className="rounded bg-black/10 px-1 dark:bg-white/10">GOOGLE_API_KEY</code> to{" "}
            <code className="rounded bg-black/10 px-1 dark:bg-white/10">.env</code> in the project root
            (next to <code className="rounded bg-black/10 px-1 dark:bg-white/10">app.py</code>), restart
            Uvicorn, reload this page, and check Settings → integrations for a green Gemini badge.
          </p>
        </div>
      )}

      {audioUrl && (
        <audio controls src={audioUrl} className="w-full max-w-md" />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {sections.map(({ key, title, text, placeholder }) => (
          <div key={key} className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
            {placeholder && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-800 dark:text-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                {integrations?.gemini === false ? "Setup: add API key" : "Demo mode"}
              </div>
            )}
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {text}
            </p>
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