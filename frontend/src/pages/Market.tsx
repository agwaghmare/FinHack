import { type FormEvent, useEffect, useState } from "react";
import { Loader2, Mic, PieChart, Search, Star, X } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { addWatchlistSymbol, getWatchlist } from "../lib/watchlistStorage";
import { Link } from "react-router-dom";
import {
  api,
  getMarketPodcastLatest,
  getMarketPodcastLatestScript,
  postMarketAudioSummary,
  postMarketPodcastGenerate,
  type PodcastSession,
} from "../lib/api";
import { MorningBriefing } from "../components/MorningBriefing";
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
  capBucket?: string | null;
  perf1m?: number | null;
  perf6m?: number | null;
  perf1y?: number | null;
  trend?: "up" | "down" | "flat";
  trailingPe?: number | null;
  trailingEps?: number | null;
  recommendationMean?: number | null;
  recommendationKey?: string | null;
  analystCount?: number | null;
};

function capBucketFromMarketCap(mc: number | null | undefined): string | null {
  if (mc == null || !Number.isFinite(mc) || mc <= 0) return null;
  if (mc >= 200e9) return "Mega cap";
  if (mc >= 10e9) return "Large cap";
  if (mc >= 2e9) return "Mid cap";
  return "Small cap";
}

function formatAnalystLabel(mean: number | null | undefined, key: string | null | undefined): string {
  const k = key
    ? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  if (mean != null && Number.isFinite(mean)) {
    return k ? `${mean.toFixed(2)} · ${k}` : mean.toFixed(2);
  }
  return k ?? "—";
}

type NarrativeArticle = {
  title: string;
  summary: string;
  url: string;
  source: string;
  time_published?: string;
  sentiment_label?: string;
};

type NarrativeBuckets = {
  macro: NarrativeArticle | null;
  sector: NarrativeArticle | null;
  international: NarrativeArticle | null;
  geopolitical: NarrativeArticle | null;
  two_names: NarrativeArticle[];
};

type EarningsWeekItem = {
  symbol: string;
  earnings_date: string;
  within_days: number;
};

type EarningsBrief = {
  symbol: string;
  main_points: string[];
};

type PredictionMarketRow = {
  question: string;
  url: string;
  volume_24h: number;
  yes_implied?: number | null;
  end_date?: string;
};

function NarrativeLane({
  title,
  subtitle,
  article,
}: {
  title: string;
  subtitle: string;
  article: NarrativeArticle | null;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500/90">{title}</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
      {article ? (
        <div className="mt-3 space-y-2">
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold leading-snug text-zinc-100 underline-offset-2 hover:text-emerald-300 hover:underline"
          >
            {article.title}
          </a>
          <p className="text-xs leading-relaxed text-zinc-400 line-clamp-6">{article.summary}</p>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
            <span>{article.source}</span>
            {article.time_published ? <span>· {article.time_published}</span> : null}
            {article.sentiment_label ? (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">{article.sentiment_label}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          No headline matched this lane in the current feed. Refresh later or check the broader news pipeline.
        </p>
      )}
    </div>
  );
}

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

const ATTENTION_LEADERS_UNIVERSE = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "AMD",
  "PLTR",
  "NFLX",
  "COIN",
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

type TopPerformersPayload = {
  has_positions?: boolean;
  period?: string;
  period_label?: string;
  items?: Array<{
    symbol: string;
    market_value?: number;
    weight_pct?: number;
    return_pct: number;
  }>;
  hint?: string | null;
  message?: string;
};

function fmtReturnPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtIsoDateShort(iso: string) {
  try {
    const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
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
  const [podcastCloseScript, setPodcastCloseScript] = useState<string | null>(null);
  const [podcastOpenScript, setPodcastOpenScript] = useState<string | null>(null);
  const [expandedLeader, setExpandedLeader] = useState<string | null>(null);
  const [earningsItems, setEarningsItems] = useState<EarningsWeekItem[]>([]);
  const [predictionMarkets, setPredictionMarkets] = useState<PredictionMarketRow[]>([]);
  const [predictionDisclaimer, setPredictionDisclaimer] = useState<string | null>(null);
  const [attentionLeaders, setAttentionLeaders] = useState<Quote[]>([]);
  const [earningsBriefs, setEarningsBriefs] = useState<Record<string, EarningsBrief>>({});
  const [portfolioPerf, setPortfolioPerf] = useState<PortfolioPerfPayload | null>(null);
  const [portfolioCurve, setPortfolioCurve] = useState<PortfolioCurvePayload | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformersPayload | null>(null);
  const [portfolioPerfLoading, setPortfolioPerfLoading] = useState(false);
  const [stockLookupInput, setStockLookupInput] = useState("");
  const [stockLookupOpen, setStockLookupOpen] = useState(false);
  const [stockModalSymbol, setStockModalSymbol] = useState("");
  const [compareInput, setCompareInput] = useState("");
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [peerCompareMessage, setPeerCompareMessage] = useState<string | null>(null);
  const [watchlistToast, setWatchlistToast] = useState<string | null>(null);
  const [narrativeBuckets, setNarrativeBuckets] = useState<NarrativeBuckets | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [px, earningsRaw, polyRaw, narrativeRaw] = await Promise.all([
          api.marketPrices("BTC,ETH"),
          api.marketEarningsWeek(7).catch(() => null),
          api.marketPredictionMarkets(8).catch(() => null),
          api.narrativeDigest(72).catch(() => null),
        ]);
        if (cancelled) return;
        const qlist = (px as { quotes?: Quote[] }).quotes ?? [];
        setQuotes(qlist);
        const nb = (narrativeRaw as { buckets?: NarrativeBuckets } | null)?.buckets;
        setNarrativeBuckets(
          nb ?? {
            macro: null,
            sector: null,
            international: null,
            geopolitical: null,
            two_names: [],
          },
        );
        const earn = (earningsRaw as { items?: EarningsWeekItem[] } | null)?.items ?? [];
        setEarningsItems(earn);
        const mk = (polyRaw as { markets?: PredictionMarketRow[]; disclaimer?: string } | null)?.markets ?? [];
        setPredictionMarkets(mk);
        setPredictionDisclaimer((polyRaw as { disclaimer?: string } | null)?.disclaimer ?? null);
      } catch {
        if (!cancelled) {
          setQuotes([]);
          setEarningsItems([]);
          setPredictionMarkets([]);
          setPredictionDisclaimer(null);
          setAttentionLeaders([]);
          setNarrativeBuckets({
            macro: null,
            sector: null,
            international: null,
            geopolitical: null,
            two_names: [],
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setNarrativeLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const uid = user?.id ?? "guest";
        const wl = new Set(getWatchlist(uid).map((s) => s.toUpperCase()));
        const universe = ATTENTION_LEADERS_UNIVERSE;
        const pxRaw = (await api.marketPrices(universe.join(","))) as { quotes?: Quote[] };
        const px = pxRaw.quotes ?? [];
        const rows = await Promise.all(
          universe.map(async (sym) => {
            const quote = px.find((q) => (q.symbol ?? "").toUpperCase() === sym) ?? { symbol: sym };
            const [histRaw, newsRaw] = await Promise.all([
              api.marketHistory(sym, "3mo", "1d").catch(() => ({})),
              api.marketNews(sym, 16).catch(() => ({})),
            ]);
            const bars = ((histRaw as { bars?: Array<{ volume?: number; close?: number }> }).bars ?? []).filter(
              (b) => typeof b?.volume === "number" && typeof b?.close === "number",
            );
            const vols = bars.map((b) => Number(b.volume ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
            const closes = bars.map((b) => Number(b.close ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
            const latestVol = vols.length ? vols[vols.length - 1] : 0;
            const avgVol = vols.length > 5 ? vols.slice(-21, -1).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(20, vols.length - 1)) : 0;
            const relVol = avgVol > 0 ? latestVol / avgVol : 0;
            const priceNow = closes.length ? closes[closes.length - 1] : Number(quote.price ?? 0);
            const dollarVol = latestVol * Math.max(priceNow, 0);
            const ch = Math.abs(Number.parseFloat(String(quote.change_percent ?? "0")) || 0);
            const articles = ((newsRaw as { articles?: Array<{ title?: string }> }).articles ?? []);
            const buzz = articles.length;
            const keywordHits = articles.filter((a) =>
              /(options|reddit|retail|meme|search|watchlist|call volume|put volume)/i.test(String(a?.title ?? "")),
            ).length;
            const watchBoost = wl.has(sym) ? 2 : 0;
            const flowScore = relVol * 35 + Math.log10(Math.max(dollarVol, 1)) * 8 + ch * 2;
            const retailScore = buzz * 1.5 + keywordHits * 6 + watchBoost * 10;
            const combined = flowScore * 0.6 + retailScore * 0.4;
            return { ...quote, symbol: sym, attention_score: combined } as Quote & { attention_score: number };
          }),
        );
        rows.sort((a, b) => b.attention_score - a.attention_score);
        if (!cancelled) setAttentionLeaders(rows.slice(0, 8));
      } catch {
        if (!cancelled) setAttentionLeaders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!clerkLoaded || !user?.id) {
      setPortfolioPerf(null);
      setPortfolioCurve(null);
      setTopPerformers(null);
      return;
    }
    let cancelled = false;
    setPortfolioPerfLoading(true);
    Promise.all([
      api.portfolioPerformance(user.id),
      api.portfolioEquityCurve(user.id, "1y"),
      api.portfolioTopPerformers(user.id, "ytd", 8).catch(() => null),
    ])
      .then(([perf, curve, top]) => {
        if (cancelled) return;
        setPortfolioPerf(perf as PortfolioPerfPayload);
        setPortfolioCurve(curve as PortfolioCurvePayload);
        setTopPerformers((top as TopPerformersPayload | null) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setPortfolioPerf(null);
          setPortfolioCurve(null);
          setTopPerformers(null);
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
    const chosen = compareSymbols.length > 0 ? compareSymbols : [base];
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
            const info = infoRaw as {
              long_name?: string;
              sector?: string;
              market_cap?: number;
              trailing_pe?: number;
              trailing_eps?: number;
              recommendation_mean?: number;
              recommendation_key?: string;
              number_of_analyst_opinions?: number;
            };
            const hist = histRaw as { bars?: unknown[] };
            const perf = perfFromBars(hist.bars);
            return {
              symbol: sym,
              longName: info.long_name,
              sector: info.sector,
              capBucket: capBucketFromMarketCap(info.market_cap),
              perf1m: barsPerf(hist.bars, 22) ?? perf.perf1m,
              perf6m: barsPerf(hist.bars, 126) ?? perf.perf6m,
              perf1y: barsPerf(hist.bars, 252) ?? perf.perf1y,
              trend: perf.trend,
              trailingPe: info.trailing_pe ?? null,
              trailingEps: info.trailing_eps ?? null,
              recommendationMean: info.recommendation_mean ?? null,
              recommendationKey: info.recommendation_key ?? null,
              analystCount: info.number_of_analyst_opinions ?? null,
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
        try {
          const s = await getMarketPodcastLatestScript(session);
          if (cancelled) return;
          if (session === "close") {
            setPodcastCloseScript((s.script ?? "").trim() || null);
            if (!podcastCloseAt) setPodcastCloseAt(s.generatedAt ?? null);
          } else {
            setPodcastOpenScript((s.script ?? "").trim() || null);
            if (!podcastOpenAt) setPodcastOpenAt(s.generatedAt ?? null);
          }
        } catch {
          if (cancelled) return;
          if (session === "close") setPodcastCloseScript(null);
          else setPodcastOpenScript(null);
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

  async function applyDefaultPeersForSymbol(s: string) {
    try {
      const res = (await api.marketPeerSuggest(s, 3)) as {
        peers?: string[];
        message?: string | null;
      };
      const peers = res.peers ?? [];
      const list = [s, ...peers].slice(0, 4);
      setCompareSymbols(list);
      setCompareInput(list.join(","));
      setPeerCompareMessage(res.message ?? null);
    } catch {
      setCompareSymbols([s, "SPY", "QQQ"]);
      setCompareInput(`${s},SPY,QQQ`);
      setPeerCompareMessage(null);
    }
  }

  function addTickerToWatchlist() {
    const s = stockLookupInput.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!s) {
      setWatchlistToast("Enter a ticker first");
      window.setTimeout(() => setWatchlistToast(null), 2200);
      return;
    }
    const uid = user?.id ?? "guest";
    const had = getWatchlist(uid).includes(s);
    addWatchlistSymbol(uid, s);
    setWatchlistToast(had ? `${s} already on your watchlist` : `Added ${s} — also on Dashboard`);
    window.setTimeout(() => setWatchlistToast(null), 2800);
  }

  async function openStockLookupModal(e?: FormEvent) {
    e?.preventDefault();
    const s = stockLookupInput.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!s) return;
    setStockModalSymbol(s);
    setStockLookupOpen(true);
    await applyDefaultPeersForSymbol(s);
  }

  async function loadEarningsBrief(symbol: string) {
    const sym = symbol.trim().toUpperCase();
    if (!sym || earningsBriefs[sym]) return;
    try {
      const raw = (await api.marketEarningsBrief(sym)) as { symbol?: string; main_points?: string[] };
      const key = (raw.symbol ?? sym).toUpperCase();
      setEarningsBriefs((prev) => ({
        ...prev,
        [key]: { symbol: key, main_points: raw.main_points ?? [] },
      }));
    } catch {
      setEarningsBriefs((prev) => ({
        ...prev,
        [sym]: { symbol: sym, main_points: ["Could not load filing/transcript summary right now."] },
      }));
    }
  }

  useEffect(() => {
    if (!earningsItems.length) return;
    earningsItems.slice(0, 4).forEach((row) => {
      void loadEarningsBrief(row.symbol);
    });
  }, [earningsItems]);

  function applyComparisonSymbols() {
    const parsed = compareInput
      .split(",")
      .map((x) => x.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
      .filter(Boolean);
    if (parsed.length === 0) return;
    setPeerCompareMessage(null);
    setCompareSymbols(Array.from(new Set(parsed)).slice(0, 4));
  }

  async function generatePodcastNow(session: PodcastSession) {
    setPodcastBusy(true);
    try {
      await postMarketPodcastGenerate(session);
      try {
        const s = await getMarketPodcastLatestScript(session);
        if (session === "close") setPodcastCloseScript((s.script ?? "").trim() || null);
        else setPodcastOpenScript((s.script ?? "").trim() || null);
      } catch {
        if (session === "close") setPodcastCloseScript(null);
        else setPodcastOpenScript(null);
      }
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
    <div className="w-full max-w-none space-y-8">
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
        <button
          type="button"
          onClick={addTickerToWatchlist}
          className="inline-flex items-center gap-2 rounded-full border border-amber-600/50 bg-amber-950/30 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-950/50"
        >
          <Star className="h-3.5 w-3.5" />
          Watchlist
        </button>
        <p className="w-full text-[11px] text-zinc-500 sm:w-auto sm:pl-2">
          Open — chart &amp; fundamentals. Watchlist — appears below next to your portfolio (watchlist &amp; sector
          mix).
        </p>
      </form>
      {watchlistToast ? (
        <p className="text-xs font-medium text-emerald-400/90">{watchlistToast}</p>
      ) : null}

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
            Part of our <span className="text-zinc-400">research &amp; education</span> story: live tape for stocks
            and crypto, narrative summaries by theme, and CPI / Fed / GDP on{" "}
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
                <PodcastPlayer audioUrl={podcastOpenUrl} scriptText={podcastOpenScript} title="Market open" />
              </div>
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Market close · 4:05pm ET</h3>
                <p className="mt-2 text-xs text-zinc-500">
                  Recap for leaders, earnings, and sentiment.
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
                <PodcastPlayer audioUrl={podcastCloseUrl} scriptText={podcastCloseScript} title="Market close" />
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
              <li><span className="font-medium text-zinc-300">Tape + sentiment:</span> earnings window and tone</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <div id="portfolio" className="glass h-fit rounded-2xl p-6">
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
                    <svg viewBox="0 0 320 120" className="h-44 w-full md:h-52" role="img" aria-label="Portfolio line graph">
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
              {topPerformers?.has_positions && (topPerformers.items?.length ?? 0) > 0 ? (
                <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Top holdings so far ({topPerformers.period_label ?? "Year to date"})
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Total return per ticker (Yahoo adjusted closes). Positive names only, ranked best to least.
                  </p>
                  <ul className="mt-3 divide-y divide-zinc-800/80">
                    {(topPerformers.items ?? []).map((row) => (
                      <li
                        key={row.symbol}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-zinc-100">{row.symbol}</span>
                          <p className="text-[10px] text-zinc-500">
                            {row.weight_pct != null ? `${row.weight_pct.toFixed(1)}% of portfolio` : ""}
                            {row.weight_pct != null && row.market_value != null ? " · " : ""}
                            {row.market_value != null
                              ? `$${row.market_value.toLocaleString(undefined, { maximumFractionDigits: 0 })} MV`
                              : null}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-400">
                          +{row.return_pct.toFixed(2)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : topPerformers?.has_positions && topPerformers.hint ? (
                <p className="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-950/30 px-4 py-3 text-xs text-zinc-500">
                  {topPerformers.hint}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">
              {portfolioPerf?.message ??
                "Add priced positions under My portfolio to see period returns."}
            </p>
          )}
        </div>

        <section id="calendar" className="glass h-fit rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Earnings this week</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Reported dates from Yahoo calendar for major tech and index names (next 7 days). Tap a ticker for chart and
            fundamentals.
          </p>
          <div className="mt-3 space-y-2 text-sm">
            {loading ? (
              <p className="text-zinc-500">Loading earnings…</p>
            ) : earningsItems.length === 0 ? (
              <p className="text-zinc-500">
                No earnings in the next week for the watchlist, or calendar data is unavailable.
              </p>
            ) : (
              earningsItems.slice(0, 8).map((row) => {
                const sym = row.symbol;
                return (
                  <button
                    key={`${sym}-${row.earnings_date}`}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 text-left transition hover:bg-zinc-900/70"
                    onClick={() => {
                      setStockModalSymbol(sym);
                      setStockLookupOpen(true);
                      void applyDefaultPeersForSymbol(sym);
                      void loadEarningsBrief(sym);
                    }}
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-zinc-100">{sym}</span>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {row.within_days === 0 ? "Today" : `In ${row.within_days} day${row.within_days === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-300">
                      {fmtIsoDateShort(row.earnings_date)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {!loading && earningsItems.length > 0 ? (
            <div className="mt-4 space-y-3">
              {earningsItems.slice(0, 4).map((row) => {
                const sym = row.symbol.toUpperCase();
                const brief = earningsBriefs[sym];
                return (
                  <div key={`brief-${sym}`} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        {sym} main points
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadEarningsBrief(sym)}
                        className="text-[10px] text-amber-400 hover:text-amber-300"
                      >
                        {brief ? "Refresh" : "Load summary"}
                      </button>
                    </div>
                    {brief?.main_points?.length ? (
                      <ul className="mt-2 space-y-1.5 text-xs text-zinc-300">
                        {brief.main_points.slice(0, 4).map((p, i) => (
                          <li key={`${sym}-p-${i}`}>- {p}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-zinc-500">
                        Pulling latest filing/transcript highlights from recent reports.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          <MorningBriefing variant="embedded" />
          <p className="mt-3 text-[11px] text-zinc-600">
            For release dates and macro regime detail, open{" "}
            <Link className="text-sky-400/90 underline underline-offset-2" to="/macro-regime">
              Macro &amp; hard assets
            </Link>
            .
          </p>
        </section>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
        <section className="glass aspect-square min-h-[24rem] overflow-y-auto rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Flow + retail attention leaders
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Combined ranking: unusual/relative volume + dollar flow with retail attention (watchlist/news/options buzz).
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-2">
            {attentionLeaders.map((q, i) => (
              <CapLeaderCard
                key={`attention-${q.symbol}-${i}`}
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

        <section
          id="narrative-digest"
          className="glass aspect-square min-h-[24rem] overflow-y-auto scroll-mt-24 rounded-2xl p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Narrative snapshot</h2>
          <p className="mt-2 text-sm text-zinc-400">
            One summary per lane from the live headline feed (keyword buckets — not editorial ranking). Open links for
            full articles.
          </p>
          {narrativeLoading && (
            <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading narrative lanes…
            </p>
          )}
          {!narrativeLoading && narrativeBuckets && (
            <div className="mt-4 space-y-4">
              <NarrativeLane
                title="Macro"
                subtitle="Broad macro: Fed, inflation, growth, rates, labor."
                article={narrativeBuckets.macro}
              />
              <NarrativeLane
                title="Sector"
                subtitle="One industry or theme update (banks, chips, energy, etc.)."
                article={narrativeBuckets.sector}
              />
              <NarrativeLane
                title="International"
                subtitle="Overseas or FX angle: regions, central banks, cross-border."
                article={narrativeBuckets.international}
              />
              <NarrativeLane
                title="Geopolitical"
                subtitle="Policy, conflict, sanctions, defense — market-relevant headlines."
                article={narrativeBuckets.geopolitical}
              />
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/90">Two names</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Single-stock catalysts (earnings, guidance, major tech names).
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {narrativeBuckets.two_names.length === 0 ? (
                    <p className="text-xs text-zinc-500 sm:col-span-2">
                      No stock-specific catalysts matched in this pull.
                    </p>
                  ) : (
                    narrativeBuckets.two_names.slice(0, 2).map((a, i) => (
                      <div key={`${a.url}-${i}`} className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold leading-snug text-zinc-100 underline-offset-2 hover:text-amber-200/90 hover:underline"
                        >
                          {a.title}
                        </a>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-400 line-clamp-5">{a.summary}</p>
                        <p className="mt-2 text-[10px] text-zinc-500">
                          {a.source}
                          {a.time_published ? ` · ${a.time_published}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section
          id="prediction-markets"
          className="glass aspect-square min-h-[24rem] overflow-y-auto scroll-mt-24 space-y-3 rounded-2xl p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Hottest prediction markets
          </h2>
          <p className="text-xs text-zinc-500">
            Polymarket by 24h volume. Links open on polymarket.com.
          </p>
          {predictionDisclaimer ? (
            <p className="text-[10px] leading-relaxed text-zinc-600">{predictionDisclaimer}</p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-1">
            {loading ? (
              <p className="col-span-full flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading markets…
              </p>
            ) : predictionMarkets.length === 0 ? (
              <p className="col-span-full text-sm text-zinc-500">
                No prediction markets loaded (Polymarket API may be unreachable).
              </p>
            ) : (
              predictionMarkets.map((m, i) => (
                <a
                  key={`${m.url}-${i}`}
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="glass block rounded-xl p-3 transition hover:-translate-y-0.5 hover:shadow-xl 2xl:max-w-none"
                >
                  <p className="line-clamp-3 text-xs font-semibold leading-snug text-zinc-100">{m.question}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
                    <span>
                      Vol:{" "}
                      <span className="tabular-nums text-zinc-300">
                        {m.volume_24h >= 1e6
                          ? `$${(m.volume_24h / 1e6).toFixed(2)}M`
                          : `$${(m.volume_24h / 1e3).toFixed(0)}k`}
                      </span>
                    </span>
                    {m.yes_implied != null ? (
                      <span className="tabular-nums text-amber-400/90">
                        Yes {(m.yes_implied * 100).toFixed(0)}%
                      </span>
                    ) : null}
                  </div>
                </a>
              ))
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

      {audioUrl && <audio controls src={audioUrl} className="w-full max-w-md" />}

      {stockLookupOpen && stockModalSymbol ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close"
            onClick={() => setStockLookupOpen(false)}
          />
          <div className="relative z-10 max-h-[min(90vh,900px)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
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
                <span className="text-[11px] text-zinc-500">
                  Stocks default to same-sector, similar market-cap peers (not broad index ETFs)
                </span>
              </div>
              {peerCompareMessage ? (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{peerCompareMessage}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  className="min-w-[14rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs uppercase text-zinc-100"
                  value={compareInput}
                  onChange={(e) => setCompareInput(e.target.value)}
                  placeholder="e.g. NVDA,AMD,INTC"
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
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {compareRows.map((r) => {
                    const trendClass =
                      r.trend === "up" ? "text-emerald-400" : r.trend === "down" ? "text-rose-400" : "text-zinc-400";
                    const fmt = (n: number | null | undefined) =>
                      n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
                    const pe =
                      r.trailingPe != null && Number.isFinite(r.trailingPe)
                        ? r.trailingPe.toFixed(1)
                        : "—";
                    const eps =
                      r.trailingEps != null && Number.isFinite(r.trailingEps)
                        ? r.trailingEps.toFixed(2)
                        : "—";
                    const analyst = formatAnalystLabel(r.recommendationMean, r.recommendationKey);
                    return (
                      <div key={r.symbol} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                        <p className="text-base font-semibold text-zinc-100">{r.symbol}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2">{r.longName ?? "—"}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          Sector: {r.sector ?? "Unknown"}
                          {r.capBucket ? (
                            <span className="text-zinc-500"> · {r.capBucket}</span>
                          ) : null}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded bg-zinc-900/80 px-2 py-1.5">
                            <p className="text-[10px] text-zinc-500">P/E (TTM)</p>
                            <p className="font-semibold tabular-nums text-zinc-200">{pe}</p>
                          </div>
                          <div className="rounded bg-zinc-900/80 px-2 py-1.5">
                            <p className="text-[10px] text-zinc-500">EPS (TTM)</p>
                            <p className="font-semibold tabular-nums text-zinc-200">{eps}</p>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-zinc-400">
                          <span className="text-zinc-500">Analyst (Yahoo): </span>
                          <span className="text-zinc-200">{analyst}</span>
                          {r.analystCount != null && r.analystCount > 0 ? (
                            <span className="text-zinc-600"> ({r.analystCount} opinions)</span>
                          ) : null}
                        </p>
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