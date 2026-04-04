import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mic,
  Minus,
  PieChart,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import {
  api,
  getMarketPodcastLatest,
  getMarketPodcastLatestScript,
  postMarketAudioSummary,
  postMarketPodcastGenerate,
  type PodcastSession,
} from "../lib/api";
import { CandlestickPanel } from "../components/CandlestickPanel";
import { PodcastPlayer } from "../components/PodcastPlayer";
import { StockInfoPanel } from "../components/StockInfoPanel";
import { WhyMattersButton } from "../components/WhyMattersSheet";

type Quote = {
  kind?: string;
  symbol?: string;
  price?: number;
  change_percent?: string;
  error?: string;
  long_name?: string;
  source?: string;
};

type NewsArticle = {
  title?: string;
  url?: string;
  summary?: string;
  overall_sentiment_label?: string;
  overall_sentiment_score?: number;
};

function sentimentAccent(label: string | undefined) {
  const u = (label ?? "").toLowerCase();
  if (u.includes("bull"))
    return {
      border: "border-l-emerald-500",
      badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
      Icon: TrendingUp,
    };
  if (u.includes("bear"))
    return {
      border: "border-l-rose-500",
      badge: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
      Icon: TrendingDown,
    };
  return {
    border: "border-l-zinc-500",
    badge: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30",
    Icon: Minus,
  };
}

function CandlestickDecor() {
  return (
    <svg
      viewBox="0 0 120 48"
      className="h-12 w-32 shrink-0 text-zinc-600"
      aria-hidden
    >
      <rect x="8" y="18" width="10" height="22" fill="currentColor" opacity="0.35" rx="1" />
      <line x1="13" y1="8" x2="13" y2="40" stroke="currentColor" strokeWidth="2" />
      <rect x="34" y="10" width="10" height="30" fill="currentColor" opacity="0.55" rx="1" />
      <line x1="39" y1="4" x2="39" y2="44" stroke="currentColor" strokeWidth="2" />
      <rect x="60" y="20" width="10" height="18" fill="currentColor" opacity="0.4" rx="1" />
      <line x1="65" y1="12" x2="65" y2="42" stroke="currentColor" strokeWidth="2" />
      <rect x="86" y="14" width="10" height="26" fill="currentColor" opacity="0.5" rx="1" />
      <line x1="91" y1="6" x2="91" y2="44" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const MARKET_CAP_LEADERS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "BRK.B",
];

const MOVER_UNIVERSE = [
  "NVDA",
  "TSLA",
  "AMD",
  "NFLX",
  "META",
  "AAPL",
  "MSFT",
  "AMZN",
  "COIN",
  "PLTR",
];

function CapLeaderCard({
  q,
  selected,
  onSelect,
}: {
  q: Quote;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const px =
    typeof q.price === "number"
      ? `$${q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : "—";
  const ch = Number.parseFloat(q.change_percent ?? "0");
  const up = ch >= 0;
  const [logo, setLogo] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!q.symbol) return;
    let cancelled = false;
    api
      .stockInfo(q.symbol)
      .then((r) => {
        const row = r as { logo_url?: string; long_name?: string };
        if (!cancelled) {
          setLogo(row.logo_url ?? null);
          setName(row.long_name ?? null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [q.symbol]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={`glass cursor-pointer rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${
        selected ? "ring-2 ring-amber-500/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-zinc-700 bg-white object-contain p-0.5"
            onError={() => setLogo(null)}
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-400">
            {(q.symbol ?? "?").slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {q.kind ?? "equity"}
          </p>
          <p className="truncate text-lg font-semibold text-zinc-100">{q.symbol ?? "—"}</p>
          {name ? <p className="truncate text-[10px] text-zinc-500">{name}</p> : null}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <WhyMattersButton
            label="Why?"
            context={{
              kind: "quote",
              symbol: q.symbol ?? "",
              label: q.symbol ?? "Instrument",
              value: `${px}${q.change_percent != null && q.change_percent !== "" ? ` · ${q.change_percent}% session` : ""}`,
              user_note: q.error ? "Quote may be delayed or fallback mock data." : "",
            }}
          />
        </div>
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${up ? "text-emerald-400" : "text-rose-400"}`}
      >
        {q.error ? "—" : px}
      </p>
      {q.change_percent != null && q.change_percent !== "" && (
        <p className={`mt-1 text-xs tabular-nums ${up ? "text-emerald-500/90" : "text-rose-500/90"}`}>
          {up ? "+" : ""}
          {q.change_percent}% day
        </p>
      )}
      {q.error && (
        <p className="mt-1 text-[10px] text-amber-500">Using fallback market data</p>
      )}
      <p className="mt-2 text-[10px] text-zinc-500">Tap card for chart, P/E, EPS, and business summary</p>
    </div>
  );
}

function QuoteCard({ q }: { q: Quote }) {
  const px =
    typeof q.price === "number"
      ? `$${q.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
      : "—";
  const kind =
    q.kind === "commodity"
      ? "commodity"
      : q.kind === "fx"
        ? "fx"
        : q.kind === "crypto"
          ? "quote"
          : "quote";

  return (
    <div className="glass rounded-2xl p-4 transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {q.kind ?? "asset"}
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">{q.symbol ?? "—"}</p>
        </div>
        <WhyMattersButton
          label="Why?"
          context={{
            kind,
            symbol: q.symbol ?? "",
            label: q.symbol ?? "Instrument",
            value: `${px}${q.change_percent != null && q.change_percent !== "" ? ` · ${q.change_percent}% session` : ""}`,
            user_note: q.error ? "Quote may be delayed or fallback mock data." : "",
          }}
        />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">
        {q.error ? "—" : px}
      </p>
      {q.change_percent != null && q.change_percent !== "" && (
        <p className="mt-1 text-xs text-zinc-500">{q.change_percent}% day</p>
      )}
      {q.error && (
        <p className="mt-1 text-[10px] text-amber-500">Using fallback market data</p>
      )}
    </div>
  );
}

type PortfolioPerfPayload = {
  has_positions?: boolean;
  periods?: {
    "1m"?: number | null;
    ytd?: number | null;
    "1y"?: number | null;
    "5y"?: number | null;
  };
  message?: string;
};

function fmtReturnPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function Market() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartSymbol, setChartSymbol] = useState("NVDA");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [podcastCloseUrl, setPodcastCloseUrl] = useState<string | null>(null);
  const [podcastOpenUrl, setPodcastOpenUrl] = useState<string | null>(null);
  const [podcastBusy, setPodcastBusy] = useState(false);
  const [podcastCloseAt, setPodcastCloseAt] = useState<string | null>(null);
  const [podcastOpenAt, setPodcastOpenAt] = useState<string | null>(null);
  const [podcastCloseScript, setPodcastCloseScript] = useState<string | null>(null);
  const [podcastOpenScript, setPodcastOpenScript] = useState<string | null>(null);
  const [expandedMover, setExpandedMover] = useState<string | null>(null);
  const [expandedLeader, setExpandedLeader] = useState<string | null>(null);
  const [movers, setMovers] = useState<Quote[]>([]);
  const [capLeaders, setCapLeaders] = useState<Quote[]>([]);
  const [news, setNews] = useState<{
    avg_sentiment?: number;
    articles?: NewsArticle[];
    error?: string;
    api_message?: string;
  } | null>(null);
  const [portfolioPerf, setPortfolioPerf] = useState<PortfolioPerfPayload | null>(null);
  const [portfolioPerfLoading, setPortfolioPerfLoading] = useState(false);
  const [stockLookupInput, setStockLookupInput] = useState("");
  const [stockLookupOpen, setStockLookupOpen] = useState(false);
  const [stockModalSymbol, setStockModalSymbol] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [px, yahooMovers, moverBatch, capBatch] = await Promise.all([
          api.marketPrices("SPY,QQQ,DIA,IWM,BTC,ETH"),
          api.marketMovers(10).catch(() => null),
          api.marketPrices(MOVER_UNIVERSE.join(",")),
          api.marketPrices(MARKET_CAP_LEADERS.join(",")),
        ]);
        if (cancelled) return;
        const qlist = (px as { quotes?: Quote[] }).quotes ?? [];
        setQuotes(qlist);
        const yq = (yahooMovers as { quotes?: Quote[] } | null)?.quotes?.filter((x) => !x.error) ?? [];
        const moverRows =
          yq.length > 0
            ? yq.slice(0, 8)
            : ((moverBatch as { quotes?: Quote[] }).quotes ?? [])
                .filter((x) => !x.error)
                .sort(
                  (a, b) =>
                    Math.abs(Number.parseFloat(b.change_percent ?? "0")) -
                    Math.abs(Number.parseFloat(a.change_percent ?? "0")),
                )
                .slice(0, 5);
        setMovers(moverRows);
        setCapLeaders(((capBatch as { quotes?: Quote[] }).quotes ?? []).slice(0, 8));
      } catch {
        if (!cancelled) {
          setQuotes([]);
          setMovers([]);
          setCapLeaders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clerkLoaded || !user?.id) {
      setPortfolioPerf(null);
      return;
    }
    let cancelled = false;
    setPortfolioPerfLoading(true);
    api
      .portfolioPerformance(user.id)
      .then((r) => {
        if (!cancelled) setPortfolioPerf(r as PortfolioPerfPayload);
      })
      .catch(() => {
        if (!cancelled) setPortfolioPerf(null);
      })
      .finally(() => {
        if (!cancelled) setPortfolioPerfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clerkLoaded, user?.id]);

  useEffect(() => {
    if (!stockLookupOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStockLookupOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stockLookupOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.marketNews("SPY", 8);
        if (!cancelled) {
          setNews(r as { avg_sentiment?: number; articles?: NewsArticle[] });
        }
      } catch {
        if (!cancelled) setNews(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const load = async (session: PodcastSession) => {
        try {
          const out = await getMarketPodcastLatest(session);
          if (cancelled) return;
          const url = URL.createObjectURL(out.audio);
          if (session === "close") {
            setPodcastCloseUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
            setPodcastCloseAt(out.generatedAt ?? null);
            setPodcastCloseScript(null);
          } else {
            setPodcastOpenUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
            setPodcastOpenAt(out.generatedAt ?? null);
            setPodcastOpenScript(null);
          }
        } catch {
          if (cancelled) return;
          if (session === "close") {
            setPodcastCloseUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            try {
              const sOut = await getMarketPodcastLatestScript("close");
              setPodcastCloseAt(sOut.generatedAt ?? null);
              setPodcastCloseScript(sOut.script ?? null);
            } catch {
              setPodcastCloseAt(null);
              setPodcastCloseScript(null);
            }
          } else {
            setPodcastOpenUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            try {
              const sOut = await getMarketPodcastLatestScript("open");
              setPodcastOpenAt(sOut.generatedAt ?? null);
              setPodcastOpenScript(sOut.script ?? null);
            } catch {
              setPodcastOpenAt(null);
              setPodcastOpenScript(null);
            }
          }
        }
      };
      await load("close");
      await load("open");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, []);

  const { etfQ, cryptoQ, stockQ } = useMemo(() => {
    const etf = new Set(["SPY", "QQQ", "DIA", "IWM"]);
    const eq: Quote[] = [];
    const cr: Quote[] = [];
    const st: Quote[] = [];
    for (const q of quotes) {
      const sym = (q.symbol ?? "").toUpperCase();
      const base = sym.replace(/\/USD.*/, "");
      if (q.kind === "commodity" || sym.includes("WTI")) {
        continue;
      }
      if (q.kind === "crypto" || base === "BTC" || base === "ETH") {
        cr.push(q);
        continue;
      }
      if (etf.has(base)) {
        eq.push(q);
      } else {
        st.push(q);
      }
    }
    return { etfQ: eq, cryptoQ: cr, stockQ: st };
  }, [quotes]);

  async function playDashboardAudio() {
    setAudioBusy(true);
    try {
      const blob = await postMarketAudioSummary({
        quotes: quotes.slice(0, 8),
      });
      const url = URL.createObjectURL(blob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);
    } catch {
      const u = new SpeechSynthesisUtterance(
        "ElevenLabs MP3 was unavailable. Add a paid ElevenLabs API plan or use browser speech from Settings help text.",
      );
      window.speechSynthesis.speak(u);
    } finally {
      setAudioBusy(false);
    }
  }

  function openStockLookupModal(e?: FormEvent) {
    e?.preventDefault();
    const s = stockLookupInput.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!s) return;
    setStockModalSymbol(s);
    setStockLookupOpen(true);
  }

  async function generatePodcastNow(session: PodcastSession) {
    setPodcastBusy(true);
    try {
      await postMarketPodcastGenerate(session);
      try {
        const out = await getMarketPodcastLatest(session);
        if (session === "close") {
          setPodcastCloseAt(out.generatedAt ?? null);
          setPodcastCloseScript(null);
          setPodcastCloseUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(out.audio);
          });
        } else {
          setPodcastOpenAt(out.generatedAt ?? null);
          setPodcastOpenScript(null);
          setPodcastOpenUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(out.audio);
          });
        }
      } catch {
        const sOut = await getMarketPodcastLatestScript(session);
        if (session === "close") {
          setPodcastCloseAt(sOut.generatedAt ?? null);
          setPodcastCloseUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
          setPodcastCloseScript(sOut.script ?? null);
        } else {
          setPodcastOpenAt(sOut.generatedAt ?? null);
          setPodcastOpenUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
          setPodcastOpenScript(sOut.script ?? null);
        }
      }
    } catch {
      window.speechSynthesis.speak(
        new SpeechSynthesisUtterance(
          "Market podcast is not available yet. Configure ElevenLabs on the server and try again.",
        ),
      );
    } finally {
      setPodcastBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={openStockLookupModal}
        className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4"
      >
        <label htmlFor="pulse-stock-search" className="text-xs font-semibold text-zinc-500">
          Stock lookup
        </label>
        <input
          id="pulse-stock-search"
          className="min-w-[10rem] flex-1 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm uppercase text-white sm:max-w-xs"
          value={stockLookupInput}
          onChange={(e) => setStockLookupInput(e.target.value)}
          placeholder="e.g. AAPL"
          maxLength={16}
          autoComplete="off"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-600 hover:bg-zinc-700"
        >
          <Search className="h-3.5 w-3.5" />
          Open
        </button>
        <p className="w-full text-[11px] text-zinc-500 sm:w-auto sm:pl-2">
          Opens an overlay with chart and fundamentals — you stay on Market Pulse.
        </p>
      </form>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Market pulse
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Live tape & sentiment
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Part of our <span className="text-zinc-400">research &amp; education</span> story: live tape for stocks,
            crypto, and ETFs. CPI, Fed funds, and GDP on{" "}
            <Link className="text-zinc-300 underline underline-offset-2" to="/commodities">
              Commodity Lens
            </Link>
            ; concepts &amp; tutor in{" "}
            <Link className="text-zinc-300 underline underline-offset-2" to="/learn">
              Learn Hub
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={playDashboardAudio}
          disabled={audioBusy}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          {audioBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          AI audio summary
        </button>
      </header>

      <section className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Your portfolio · performance so far
            </h2>
          </div>
          <Link
            to="/portfolio"
            className="text-xs font-semibold text-amber-500/90 underline-offset-2 hover:underline"
          >
            Edit holdings
          </Link>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Market-value weighted total return from adjusted closes (approximation). Periods: 1Y, 5Y, 1M, YTD.
        </p>
        {!clerkLoaded ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : !user ? (
          <p className="mt-4 text-sm text-zinc-400">
            Sign in to see performance for positions saved under{" "}
            <Link className="text-amber-500/90 underline" to="/portfolio">
              My portfolio
            </Link>
            .
          </p>
        ) : portfolioPerfLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your performance…
          </p>
        ) : portfolioPerf?.has_positions ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { k: "1y" as const, label: "1Y" },
                { k: "5y" as const, label: "5Y" },
                { k: "1m" as const, label: "1M" },
                { k: "ytd" as const, label: "YTD" },
              ] as const
            ).map(({ k, label }) => {
              const v = portfolioPerf.periods?.[k];
              const num = typeof v === "number" ? v : null;
              const up = num != null && num >= 0;
              return (
                <div
                  key={k}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-center"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {label}
                  </p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      num == null ? "text-zinc-500" : up ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {fmtReturnPct(num)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            {portfolioPerf?.message ??
              "Add priced positions under My portfolio to see period returns."}
          </p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Market open · audio briefing
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Scheduled <span className="font-semibold text-zinc-200">9:35am</span> ET weekdays. Uses ElevenLabs
            (warmer voice defaults on the server). Generate manually if the schedule has not run yet.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={podcastBusy}
              onClick={() => generatePodcastNow("open")}
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
            >
              {podcastBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Generate open"
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {podcastOpenAt ? `Last generated: ${podcastOpenAt}` : "Not generated yet."}
          </p>
          <PodcastPlayer
            audioUrl={podcastOpenUrl}
            scriptText={podcastOpenScript}
            title="Market open"
          />
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Market close · recap
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Scheduled <span className="font-semibold text-zinc-200">4:05pm</span> ET weekdays. Full tape, movers,
            leaders, and headline sentiment.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={podcastBusy}
              onClick={() => generatePodcastNow("close")}
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
            >
              {podcastBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Generate close"
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {podcastCloseAt ? `Last generated: ${podcastCloseAt}` : "Not generated yet."}
          </p>
          <PodcastPlayer
            audioUrl={podcastCloseUrl}
            scriptText={podcastCloseScript}
            title="Market close"
          />
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            What you’ll hear (daily)
          </h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-400">
            <li>
              <span className="font-medium text-zinc-300">Macro:</span> one line from the broad macro headline set
            </li>
            <li>
              <span className="font-medium text-zinc-300">Sector:</span> one industry or theme story
            </li>
            <li>
              <span className="font-medium text-zinc-300">International:</span> overseas or FX-relevant angle
            </li>
            <li>
              <span className="font-medium text-zinc-300">Geopolitical:</span> policy or conflict channel into markets
            </li>
            <li>
              <span className="font-medium text-zinc-300">Two names:</span> earnings or single-stock catalysts
            </li>
            <li>
              <span className="font-medium text-zinc-300">Tape + sentiment:</span> movers, mega-caps, and aggregated tone
            </li>
          </ul>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          News & sentiment (SPY)
        </h2>
        {news ? (
          <div className="mt-4 space-y-4">
            {news.error && (
              <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                {news.error}
              </p>
            )}
            {news.api_message && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
                {news.api_message}
              </p>
            )}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
              <div className="flex flex-1 flex-col gap-3 rounded-xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/80 to-zinc-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CandlestickDecor />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Lexical headline score
                      </p>
                      <p className="text-lg font-semibold text-zinc-100">
                        {typeof news.avg_sentiment === "number" ? news.avg_sentiment.toFixed(2) : "—"}
                      </p>
                    </div>
                  </div>
                  <PieChart className="h-8 w-8 text-zinc-600" aria-hidden />
                </div>
                <p className="text-xs text-zinc-500">
                  Simple keyword balance on titles (not an ML model). <strong className="text-zinc-300">0.00</strong> means
                  neutral — no strong bullish or bearish words dominated the sample. Hover a headline for summary + URL.
                </p>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-rose-600 via-zinc-500 to-emerald-500 opacity-90"
                    aria-hidden
                  />
                  <div
                    className="absolute top-0 h-3 w-1.5 -translate-x-1/2 rounded-sm bg-white shadow-md ring-2 ring-zinc-900"
                    style={{
                      left: `${Math.min(100, Math.max(0, (((news.avg_sentiment ?? 0) + 1) / 2) * 100))}%`,
                    }}
                    title="Average sentiment position"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <WhyMattersButton
                    label="Why sentiment?"
                    context={{
                      kind: "quote",
                      symbol: "SPY",
                      label: "News sentiment (SPY basket)",
                      value: `Average score ${typeof news.avg_sentiment === "number" ? news.avg_sentiment.toFixed(2) : "—"}`,
                      user_note: "Headline NLP is noisy; use it as context, not a trigger by itself.",
                    }}
                  />
                  <span className="text-xs text-zinc-500">
                    Risk-on vs risk-off positioning often tracks tone.
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {(news.articles ?? []).slice(0, 6).map((a, i) => {
                const acc = sentimentAccent(a.overall_sentiment_label);
                const Icon = acc.Icon;
                const href = (a.url && a.url !== "#" ? a.url : undefined) ?? "#";
                const tip = a.summary?.trim()
                  ? `${a.summary.slice(0, 220)}${a.summary.length > 220 ? "…" : ""}\n\n${href}`
                  : href;
                return (
                  <a
                    key={`${a.url ?? "u"}-${i}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={tip}
                    className={`block rounded-xl border border-zinc-800 border-l-4 ${acc.border} bg-zinc-900/40 px-3 py-2.5 text-left text-sm text-zinc-100 shadow-sm transition hover:bg-zinc-900/70`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${acc.badge}`}
                      >
                        <Icon className="h-3 w-3" />
                        {a.overall_sentiment_label ?? "Neutral"}
                      </span>
                    </div>
                    <span className="mt-1 block font-medium leading-snug text-zinc-100 underline-offset-2 hover:underline">
                      {a.title ?? "Untitled headline"}
                    </span>
                    {a.summary ? (
                      <span className="mt-1 block line-clamp-2 text-xs text-zinc-500">{a.summary}</span>
                    ) : null}
                  </a>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            News sentiment currently unavailable. This is often due to external API throttling.
          </p>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Top market movers
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Yahoo Finance · Day gainers. Tap a row for candlesticks, business summary, and valuation fields.
        </p>
        <div className="mt-3 space-y-2 text-sm">
          {movers.length === 0 ? (
            <p className="text-zinc-500">Loading movers...</p>
          ) : (
            movers.map((x) => {
              const ch = Number.parseFloat(x.change_percent ?? "0");
              const up = ch >= 0;
              const sym = x.symbol ?? "";
              const open = expandedMover === sym;
              return (
                <div key={sym} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-zinc-900/70"
                    onClick={() => setExpandedMover((prev) => (prev === sym ? null : sym))}
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-zinc-100">{sym}</span>
                      {x.long_name ? (
                        <p className="truncate text-[10px] text-zinc-500" title={x.long_name}>
                          {x.long_name}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-right">
                      {typeof x.price === "number" ? (
                        <span className="hidden text-xs text-zinc-500 sm:inline">
                          ${x.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      ) : null}
                      <span
                        className={`tabular-nums font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {up ? "+" : ""}
                        {x.change_percent ?? "0"}%
                      </span>
                      <span className="text-[10px] text-zinc-500">{open ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {open && sym ? (
                    <div className="border-t border-zinc-800/80 px-3 pb-4 pt-2">
                      <StockInfoPanel symbol={sym} showChart chartPeriod="1y" />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Market-cap weighted leaders
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Largest-cap names often drive index direction. Track these stocks first during high-volume sessions.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {capLeaders.map((q, i) => (
            <CapLeaderCard
              key={`cap-${q.symbol}-${i}`}
              q={q}
              selected={expandedLeader === q.symbol}
              onSelect={() =>
                setExpandedLeader((prev) => (prev === q.symbol ? null : (q.symbol ?? null)))
              }
            />
          ))}
        </div>
        {expandedLeader ? (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <StockInfoPanel symbol={expandedLeader} showChart chartPeriod="1y" />
          </div>
        ) : null}
      </section>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading quotes…
        </div>
      )}

      {quotes.length === 0 && !loading && (
        <div className="glass rounded-2xl p-6 text-sm text-zinc-500">
          No market quotes returned right now. Yahoo Finance (yfinance) may be rate-limited or unreachable.
        </div>
      )}

      {audioUrl && (
        <audio controls src={audioUrl} className="w-full max-w-md" />
      )}

      <section id="etfs" className="scroll-mt-24 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">ETFs & indices</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {etfQ.map((q, i) => (
            <QuoteCard key={`etf-${q.symbol}-${i}`} q={q} />
          ))}
          {etfQ.length === 0 && !loading && (
            <p className="col-span-full text-sm text-zinc-500">No ETF quotes yet.</p>
          )}
        </div>
      </section>

      <section id="crypto" className="scroll-mt-24 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Crypto</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cryptoQ.map((q, i) => (
            <QuoteCard key={`c-${q.symbol}-${i}`} q={q} />
          ))}
          {cryptoQ.length === 0 && !loading && (
            <p className="col-span-full text-sm text-zinc-500">No crypto quotes yet.</p>
          )}
        </div>
      </section>

      <section id="stocks" className="scroll-mt-24 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Equities</h2>
        <p className="text-xs text-zinc-500">
          Single-name equities appear here when added to the batch; ETFs above cover broad beta.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stockQ.map((q, i) => (
            <QuoteCard key={`s-${q.symbol}-${i}`} q={q} />
          ))}
          {stockQ.length === 0 && !loading && (
            <p className="col-span-full text-sm text-zinc-500">No additional equity rows.</p>
          )}
        </div>
      </section>

      {stockLookupOpen && stockModalSymbol ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close"
            onClick={() => setStockLookupOpen(false)}
          />
          <div className="relative z-10 max-h-[min(90vh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-100">{stockModalSymbol}</h2>
              <button
                type="button"
                onClick={() => setStockLookupOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <StockInfoPanel symbol={stockModalSymbol} showChart chartPeriod="1y" />
          </div>
        </div>
      ) : null}

      <div id="chart" className="glass scroll-mt-24 rounded-2xl p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Price chart (daily candlesticks)
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-zinc-500" htmlFor="chart-symbol">
              Symbol
            </label>
            <input
              id="chart-symbol"
              className="w-36 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm uppercase text-white"
              value={chartSymbol}
              onChange={(e) => setChartSymbol(e.target.value.toUpperCase())}
              placeholder="NVDA"
              maxLength={12}
            />
            <span className="text-xs text-zinc-500">mplfinance chart · 1y · 1d</span>
            <WhyMattersButton
              label="Chart?"
              context={{
                kind: "chart",
                label: `${chartSymbol.trim() || "NVDA"} candlesticks`,
                value: "Each bar is one trading day (open/high/low/close).",
                user_note: "Trends persist until a narrative or liquidity regime breaks them.",
              }}
            />
          </div>
        </div>
        <CandlestickPanel symbol={chartSymbol.trim() || "NVDA"} period="1y" interval="1d" />
      </div>

    </div>
  );
}
