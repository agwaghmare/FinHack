import { useEffect, useState } from "react";
import { api } from "../lib/api";
import clsx from "clsx";
import { ExternalLink, X } from "lucide-react";

type Article = {
  title: string;
  url: string;
  time_published?: string;
  source?: string;
  banner_image?: string;
  overall_sentiment_label?: string;
  overall_sentiment_score?: number;
  summary?: string;
};

type Feed = {
  avg_sentiment?: number;
  articles?: Article[];
};

function labelFromScore(s: number): string {
  if (s >= 0.15) return "bullish";
  if (s <= -0.15) return "bearish";
  return "neutral";
}

function formatTime(raw?: string) {
  if (!raw || raw.length < 8) return "";
  const y = raw.slice(0, 4);
  const mo = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  return `${y}-${mo}-${d}`;
}

export function News() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [popup, setPopup] = useState<Article | null>(null);

  useEffect(() => {
    api
      .newsSentiment("SPY", 50)
      .then((r) => setFeed(r as Feed))
      .catch(() => setFeed({ avg_sentiment: 0, articles: [] }));
  }, []);

  const score = feed?.avg_sentiment ?? 0;
  const label = labelFromScore(score);
  const articles = feed?.articles ?? [];

  const badge = clsx(
    "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
    label === "bullish" &&
      "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
    label === "bearish" &&
      "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30",
    label === "neutral" &&
      "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/25",
  );

  return (
    <div className="space-y-8 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Sentiment
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            News
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Live headlines from GNews + Yahoo (up to 50). Click a card to expand.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Aggregate (SPY)</p>
          <p className={badge}>{label}</p>
          <p className="mt-1 text-xs tabular-nums text-zinc-400">
            score {score.toFixed(3)}
          </p>
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {articles.map((a, idx) => (
          <button
            key={`${a.url}-${idx}`}
            type="button"
            onClick={() => setPopup(a)}
            className="group relative overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/60 text-left shadow-soft transition-all duration-300 hover:z-10 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-2xl dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:hover:border-zinc-600"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
              {a.banner_image ? (
                <img
                  src={a.banner_image}
                  alt=""
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-xs text-zinc-400">
                  FinSight
                </div>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                {a.overall_sentiment_label ?? "—"}
              </span>
            </div>
            <div className="p-4">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                {a.title}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                {a.summary || "Open for full story · source data from feed."}
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                <span>{a.source ?? "—"}</span>
                <span>{formatTime(a.time_published)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {articles.length === 0 && (
        <p className="text-center text-sm text-zinc-500">
          No articles returned — check GNEWS_API_KEY or network; Yahoo fallback may be empty for this symbol.
        </p>
      )}

      {popup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPopup(null)}
            aria-label="Close"
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-0 shadow-2xl ring-1 ring-white/10">
            <div className="relative aspect-video w-full overflow-hidden bg-zinc-800">
              {popup.banner_image ? (
                <img
                  src={popup.banner_image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  No image
                </div>
              )}
              <button
                type="button"
                onClick={() => setPopup(null)}
                className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-400">
                  {popup.overall_sentiment_label ?? "—"}
                </span>
                <span>{popup.source}</span>
                <span>{formatTime(popup.time_published)}</span>
              </div>
              <h2 className="text-xl font-semibold leading-tight text-white">
                {popup.title}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-300">
                {popup.summary || "Read the full article on the publisher site."}
              </p>
              <a
                href={popup.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
              >
                Open article <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
