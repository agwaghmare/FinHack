import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mic,
  PieChart,
  Search,
  X,
} from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import {
  api,
  getMarketPodcastLatest,
  postMarketAudioSummary,
  postMarketPodcastGenerate,
  type PodcastSession,
} from "../lib/api";
import { LoginStreakBanner as PulseLoginStreakBanner } from "../components/LoginStreakBanner";
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
  why_today?: string;
  source?: string;
};

type CompareRow = {
  symbol: string;
  longName?: string;
  sector?: string;
  perf1m?: number | null;
  perf6m?: number | null;
  perf1y?: number | null;
  trend?: "up" | "down" | "flat";
};

function pctBetween(now: number, prev: number) {
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((now / prev - 1) * 100);
}

function perfFromBars(rawBars: unknown): { perf1m: number | null; perf6m: number | null; perf1y: number | null; trend: CompareRow["trend"] } {
  const bars = Array.isArray(rawBars) ? rawBars : [];
  const closes = bars
    .map((b) => {
      if (!b || typeof b !== "object") return null;
      const c = Number((b as { close?: unknown }).close);
      return Number.isFinite(c) ? c : null;
    })
    .filter((v): v is number => v != null);
  if (closes.length < 5) return { perf1m: null, perf6m: null, perf1y: null, trend: "flat" };
  const last = closes[closes.length - 1];
  const m1 = closes[Math.max(0, closes.length - 22)];
  const m6 = closes[Math.max(0, closes.length - 126)];
  const y1 = closes[Math.max(0, closes.length - 252)];
  const perf1m = pctBetween(last, m1);
  const perf6m = pctBetween(last, m6);
  const perf1y = pctBetween(last, y1);
  const trend = perf6m == null ? "flat" : perf6m > 3 ? "up" : perf6m < -3 ? "down" : "flat";
  return { perf1m, perf6m, perf1y, trend };
}

function barsPerf(rawBars: unknown, stepsBack: number): number | null {
  const bars = Array.isArray(rawBars) ? rawBars : [];
  const closes = bars
    .map((b) => {
      if (!b || typeof b !== "object") return null;
      const c = Number((b as { close?: unknown }).close);
      return Number.isFinite(c) ? c : null;
    })
    .filter((v): v is number => v != null);
  if (closes.length < 3) return null;
  const now = closes[closes.length - 1];
  const prev = closes[Math.max(0, closes.length - 1 - stepsBack)];
  return pctBetween(now, prev);
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
          <p className="truncate text-base font-semibold text-zinc-100">{q.symbol ?? "—"}</p>
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
        className={`mt-2 text-xl font-semibold tabular-nums ${up ? "text-emerald-400" : "text-rose-400"}`}
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

type PortfolioCurvePayload = {
  has_positions?: boolean;
  period?: string;
  points?: Array<{
    date: string;
    value: number;
    growth_pct?: number | null;
  }>;
  start_value?: number;
  end_value?: number;
  as_of?: string;
  message?: string;
};

function fmtReturnPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function moverWhyText(q: Quote) {
  const sym = q.symbol ?? "This stock";
  const ch = Number.parseFloat(q.change_percent ?? "0");
  const up = ch >= 0;
  if (Math.abs(ch) >= 8) {
    return `${sym} is making an outsized move; likely earnings/news or a major repricing event.`;
  }
  if (Math.abs(ch) >= 4) {
    return `${sym} is moving on notable momentum, sector sympathy, or fresh headlines today.`;
  }
  return up
    ? `${sym} is up on broad risk-on flows and name-specific momentum signals.`
    : `${sym} is down as sellers price in risk, weak guidance tone, or position unwinds.`;
}

function portfolioLinePoints(values: number[]) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = values.length === 1 ? 160 : (i / (values.length - 1)) * 320;
      const y = 100 - ((v - min) / span) * 88;
      return `${x.toFixed(1)},${(y + 8).toFixed(1)}`;
    })
    .join(" ");
}

function portfolioLineArea(values: number[]) {
  const points = portfolioLinePoints(values);
  if (!points) return "";
  const firstX = values.length === 1 ? 160 : 0;
  const lastX = values.length === 1 ? 160 : 320;
  return `${firstX},108 ${points} ${lastX},108`;
}

export function Market() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [podcastCloseUrl, setPodcastCloseUrl] = useState<string | null>(null);
  const [podcastOpenUrl, setPodcastOpenUrl] = useState<string | null>(null);
  const [podcastBusy, setPodcastBusy] = useState(false);
  const [podcastCloseAt, setPodcastCloseAt] = useState<string | null>(null);
  const [podcastOpenAt, setPodcastOpenAt] = useState<string | null>(null);
  const [expandedMover, setExpandedMover] = useState<string | null>(null);
  const [expandedLeader, setExpandedLeader] = useState<string | null>(null);
  const [movers, setMovers] = useState<Quote[]>([]);
  const [capLeaders, setCapLeaders] = useState<Quote[]>([]);
  const [portfolioPerf, setPortfolioPerf] = useState<PortfolioPerfPayload | null>(null);
  const [portfolioCurve, setPortfolioCurve] = useState<PortfolioCurvePayload | null>(null);
  const [portfolioPerfLoading, setPortfolioPerfLoading] = useState(false);
  const [stockLookupInput, setStockLookupInput] = useState("");
  const [stockLookupOpen, setStockLookupOpen] = useState(false);
  const [stockModalSymbol, setStockModalSymbol] = useState("");
  const [compareInput, setCompareInput] = useState("");
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [px, yahooMovers, moverBatch, capBatch] = await Promise.all([
          api.marketPrices("SPY,QQQ,DIA,IWM,BTC,ETH"),
          api.marketMovers(5).catch(() => null),
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
      setPortfolioCurve(null);
      return;
    }
    let cancelled = false;
    setPortfolioPerfLoading(true);
    Promise.all([
      api.portfolioPerformance(user.id),
      api.portfolioEquityCurve(user.id, "1y"),
    ])
      .then(([perf, curve]) => {
        if (cancelled) return;
        setPortfolioPerf(perf as PortfolioPerfPayload);
        setPortfolioCurve(curve as PortfolioCurvePayload);
      })
      .catch(() => {
        if (!cancelled) {
          setPortfolioPerf(null);
          setPortfolioCurve(null);
        }
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
    if (!stockLookupOpen || !stockModalSymbol) return;
    const base = stockModalSymbol.trim().toUpperCase();
    const chosen = compareSymbols.length > 0 ? compareSymbols : [base, "SPY"];
    let cancelled = false;
    setCompareLoading(true);
    (async () => {
      try {
        const rows = await Promise.all(
          chosen.map(async (sym) => {
            const [infoRaw, histRaw] = await Promise.all([
              api.stockInfo(sym).catch(() => ({})),
              api.marketHistory(sym, "1y", "1d").catch(() => ({})),
            ]);
            const info = infoRaw as { long_name?: string; sector?: string };
            const hist = histRaw as { bars?: unknown[] };
            const perf = perfFromBars(hist.bars);
            return {
              symbol: sym,
              longName: info.long_name,
              sector: info.sector,
              perf1m: barsPerf(hist.bars, 22) ?? perf.perf1m,
              perf6m: barsPerf(hist.bars, 126) ?? perf.perf6m,
              perf1y: barsPerf(hist.bars, 252) ?? perf.perf1y,
              trend: perf.trend,
            } as CompareRow;
          }),
        );
        if (!cancelled) setCompareRows(rows);
      } catch {
        if (!cancelled) setCompareRows([]);
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stockLookupOpen, stockModalSymbol, compareSymbols]);

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
          } else {
            setPodcastOpenUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
            setPodcastOpenAt(out.generatedAt ?? null);
          }
        } catch {
          if (cancelled) return;
          if (session === "close") {
            setPodcastCloseUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            setPodcastCloseAt(null);
          } else {
            setPodcastOpenUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            setPodcastOpenAt(null);
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

  const { etfQ, cryptoQ } = useMemo(() => {
    const etf = new Set(["SPY", "QQQ", "DIA", "IWM"]);
    const eq: Quote[] = [];
    const cr: Quote[] = [];
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
      }
    }
    return { etfQ: eq, cryptoQ: cr };
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
      setAudioUrl(null);
    } finally {
      setAudioBusy(false);
    }
  }

  function openStockLookupModal(e?: FormEvent) {
    e?.preventDefault();
    const s = stockLookupInput.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!s) return;
    setStockModalSymbol(s);
    setCompareInput(`${s},SPY,QQQ`);
    setCompareSymbols([s, "SPY", "QQQ"]);
    setStockLookupOpen(true);
  }

  function applyComparisonSymbols() {
    const parsed = compareInput
      .split(",")
      .map((x) => x.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
      .filter(Boolean);
    if (parsed.length === 0) return;
    setCompareSymbols(Array.from(new Set(parsed)).slice(0, 4));
  }

  async function generatePodcastNow(session: PodcastSession) {
    setPodcastBusy(true);
    try {
      await postMarketPodcastGenerate(session);
      try {
        const out = await getMarketPodcastLatest(session);
        if (session === "close") {
          setPodcastCloseAt(out.generatedAt ?? null);
          setPodcastCloseUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(out.audio);
          });
        } else {
          setPodcastOpenAt(out.generatedAt ?? null);
          setPodcastOpenUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(out.audio);
          });
        }
      } catch {
        if (session === "close") {
          setPodcastCloseAt(null);
          setPodcastCloseUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        } else {
          setPodcastOpenAt(null);
          setPodcastOpenUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      }
    } catch {
      // No browser TTS fallback: keep podcasts human-only audio.
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

      <PulseLoginStreakBanner />

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
            <Link className="text-zinc-300 underline underline-offset-2" to="/macro-regime">
              Macro Regime
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
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Market open + close podcast rectangle
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              Morning setup and close recap in one wide panel.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Market open · 9:35am ET</h3>
                <p className="mt-2 text-xs text-zinc-500">
                  Scheduled weekdays. Generate manually if it has not run yet.
                </p>
                <button
                  type="button"
                  disabled={podcastBusy}
                  onClick={() => generatePodcastNow("open")}
                  className="mt-3 rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
                >
                  {podcastBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generate open"}
                </button>
                <p className="mt-2 text-[11px] text-zinc-500">
                  {podcastOpenAt ? `Last generated: ${podcastOpenAt}` : "Not generated yet."}
                </p>
                <PodcastPlayer audioUrl={podcastOpenUrl} title="Market open" />
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Market close · 4:05pm ET</h3>
                <p className="mt-2 text-xs text-zinc-500">
                  Recap for movers, leaders, and sentiment.
                </p>
                <button
                  type="button"
                  disabled={podcastBusy}
                  onClick={() => generatePodcastNow("close")}
                  className="mt-3 rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
                >
                  {podcastBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generate close"}
                </button>
                <p className="mt-2 text-[11px] text-zinc-500">
                  {podcastCloseAt ? `Last generated: ${podcastCloseAt}` : "Not generated yet."}
                </p>
                <PodcastPlayer audioUrl={podcastCloseUrl} title="Market close" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">What you'll hear (daily)</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-400">
              <li><span className="font-medium text-zinc-300">Macro:</span> broad macro headlines</li>
              <li><span className="font-medium text-zinc-300">Sector:</span> one industry/theme update</li>
              <li><span className="font-medium text-zinc-300">International:</span> overseas or FX angle</li>
              <li><span className="font-medium text-zinc-300">Geopolitical:</span> policy/conflict impact</li>
              <li><span className="font-medium text-zinc-300">Two names:</span> single-stock catalysts</li>
              <li><span className="font-medium text-zinc-300">Tape + sentiment:</span> movers and tone</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="glass rounded-2xl p-6">
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
            <>
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
              {portfolioCurve?.has_positions && (portfolioCurve.points?.length ?? 0) > 1 ? (
                <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Equity curve (capital growth)
                  </p>
                  <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2">
                    <svg viewBox="0 0 320 120" className="h-32 w-full" role="img" aria-label="Portfolio line graph">
                      <defs>
                        <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="108" x2="320" y2="108" className="stroke-zinc-700" strokeWidth="1" />
                      <polygon
                        points={portfolioLineArea((portfolioCurve.points ?? []).map((x) => x.value))}
                        fill="url(#equityFill)"
                      />
                      <polyline
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={portfolioLinePoints((portfolioCurve.points ?? []).map((x) => x.value))}
                      />
                      {(portfolioCurve.points ?? []).map((p, idx) => {
                        const values = (portfolioCurve.points ?? []).map((x) => x.value);
                        const min = Math.min(...values);
                        const max = Math.max(...values);
                        const span = max - min || 1;
                        const x = values.length === 1 ? 160 : (idx / (values.length - 1)) * 320;
                        const y = 100 - ((p.value - min) / span) * 88 + 8;
                        const up = (p.growth_pct ?? 0) >= 0;
                        return <circle key={`${p.date}-${idx}`} cx={x} cy={y} r="3.5" fill={up ? "#34d399" : "#fb7185"} />;
                      })}
                    </svg>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                      <p className="text-zinc-500">{(portfolioCurve.points ?? [])[0]?.date ?? "—"}</p>
                      <p className="text-zinc-500">
                        {(portfolioCurve.points ?? [])[Math.floor((portfolioCurve.points?.length ?? 1) / 2)]?.date ?? "—"}
                      </p>
                      <p className="text-zinc-500">
                        {(portfolioCurve.points ?? [])[Math.max(0, (portfolioCurve.points?.length ?? 1) - 1)]?.date ?? "—"}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Start capital</p>
                        <p className="text-xs font-semibold text-zinc-200">
                          $
                          {(portfolioCurve.start_value ?? 0).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Growth</p>
                        <p
                          className={`text-xs font-semibold ${
                            (portfolioCurve.start_value ?? 0) > 0 &&
                            ((portfolioCurve.end_value ?? 0) / (portfolioCurve.start_value ?? 1) - 1) * 100 >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {(() => {
                            const s = portfolioCurve.start_value ?? 0;
                            const e = portfolioCurve.end_value ?? 0;
                            if (s <= 0) return "—";
                            const g = (e / s - 1) * 100;
                            return `${g >= 0 ? "+" : ""}${g.toFixed(2)}%`;
                          })()}
                        </p>
                      </div>
                      <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Current capital</p>
                        <p className="text-xs font-semibold text-zinc-200">
                          $
                          {(portfolioCurve.end_value ?? 0).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">
              {portfolioPerf?.message ??
                "Add priced positions under My portfolio to see period returns."}
            </p>
          )}
        </div>

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
              movers.slice(0, 5).map((x) => {
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
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-zinc-100">{sym}</span>
                        {x.long_name ? (
                          <p className="truncate text-[10px] text-zinc-500" title={x.long_name}>
                            {x.long_name}
                          </p>
                        ) : null}
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                          {x.why_today?.trim() || moverWhyText(x)}
                        </p>
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
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Market-cap weighted leaders
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Largest-cap names often drive index direction. Track these stocks first during high-volume sessions.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

        <section id="etfs" className="glass scroll-mt-24 rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">ETFs & indices</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {etfQ.map((q, i) => (
              <QuoteCard key={`etf-${q.symbol}-${i}`} q={q} />
            ))}
            {etfQ.length === 0 && !loading && (
              <p className="col-span-full text-sm text-zinc-500">No ETF quotes yet.</p>
            )}
          </div>
        </section>
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
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  Sector + performance comparison
                </h3>
                <span className="text-[11px] text-zinc-500">Compare multiple securities side by side</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  className="min-w-[14rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs uppercase text-zinc-100"
                  value={compareInput}
                  onChange={(e) => setCompareInput(e.target.value)}
                  placeholder="e.g. NVDA,AMD,QQQ"
                />
                <button
                  type="button"
                  onClick={applyComparisonSymbols}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500"
                >
                  Compare
                </button>
              </div>
              {compareLoading ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comparison…
                </p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {compareRows.map((r) => {
                    const trendClass =
                      r.trend === "up" ? "text-emerald-400" : r.trend === "down" ? "text-rose-400" : "text-zinc-400";
                    const fmt = (n: number | null | undefined) =>
                      n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
                    return (
                      <div key={r.symbol} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                        <p className="text-base font-semibold text-zinc-100">{r.symbol}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{r.longName ?? "—"}</p>
                        <p className="mt-1 text-xs text-zinc-400">Sector: {r.sector ?? "Unknown"}</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded bg-zinc-900 p-1.5">
                            <p className="text-[10px] text-zinc-500">1M</p>
                            <p className="font-semibold text-zinc-200">{fmt(r.perf1m)}</p>
                          </div>
                          <div className="rounded bg-zinc-900 p-1.5">
                            <p className="text-[10px] text-zinc-500">6M</p>
                            <p className="font-semibold text-zinc-200">{fmt(r.perf6m)}</p>
                          </div>
                          <div className="rounded bg-zinc-900 p-1.5">
                            <p className="text-[10px] text-zinc-500">1Y</p>
                            <p className="font-semibold text-zinc-200">{fmt(r.perf1y)}</p>
                          </div>
                        </div>
                        <p className={`mt-2 text-xs font-medium ${trendClass}`}>
                          Trend: {r.trend === "up" ? "Uptrend" : r.trend === "down" ? "Downtrend" : "Sideways"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}