/** Trailing slash or empty env breaks requests (browser may hit Vite instead of FastAPI). */
function normalizeApiBase(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) {
    // Empty VITE_API_URL + Vite proxy (see vite.config.ts) → same-origin in dev.
    if (import.meta.env.DEV) return "";
    return "http://127.0.0.1:8001";
  }
  return t.replace(/\/+$/, "");
}

export const apiBase = normalizeApiBase(import.meta.env.VITE_API_URL as string | undefined);
const base = apiBase;

export type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter | null = null;

export function setClerkTokenGetter(fn: TokenGetter | null) {
  getToken = fn;
}

async function withAuth(init?: RequestInit): Promise<RequestInit> {
  const method = (init?.method ?? "GET").toUpperCase();
  const incoming = (init?.headers as Record<string, string>) ?? {};
  const headers: Record<string, string> = { ...incoming };
  if (method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (getToken) {
    try {
      const t = await getToken();
      if (t) headers["Authorization"] = `Bearer ${t}`;
    } catch {
      /* ignore */
    }
  }
  return { ...init, headers };
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await withAuth(init);
  const url = (p: string) => `${base}${p}`;
  let r = await fetch(url(path), auth);
  // Some deployments only mount routes under `/api` — retry once.
  if (!r.ok && r.status === 404 && path.startsWith("/") && !path.startsWith("/api/")) {
    const r2 = await fetch(url(`/api${path}`), auth);
    if (r2.ok) {
      return r2.json() as Promise<T>;
    }
    r = r2;
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json() as Promise<T>;
}

export const api = {
  marketPrice: (symbol: string) =>
    j(`/market/price/${encodeURIComponent(symbol)}`),
  marketPrices: (symbols: string) =>
    j(`/market/prices?symbols=${encodeURIComponent(symbols)}`),
  marketHistory: (symbol: string, period = "1y", interval = "1d") =>
    j(
      `/market/ohlc?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}`,
    ),
  /** PNG candlestick (mplfinance); use as `<img src={...} />` — not JSON. */
  marketOhlcChartUrl: (symbol: string, period = "1y", interval = "1d") =>
    `${base}/market/ohlc/chart.png?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}`,
  marketMacro: () => j("/market/macro"),
  /** Yahoo Finance day gainers (real movers). */
  marketMovers: (count = 8) =>
    j(`/market/movers?count=${encodeURIComponent(String(count))}`),
  /** yfinance fundamentals + Clearbit logo */
  stockInfo: (symbol: string) =>
    j(`/market/stock-info?symbol=${encodeURIComponent(symbol)}`),
  marketNews: (symbol = "SPY", limit = 20) =>
    j(`/market/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`),
  marketPortfolio: (userId: string) =>
    j(`/market/portfolio/${encodeURIComponent(userId)}`),
  newsSentiment: (symbol: string, limit = 40) =>
    j(`/news/sentiment/${encodeURIComponent(symbol)}?limit=${limit}`),
  macro: () => j("/macro/indicators"),
  portfolioAnalyze: (body: unknown) =>
    j("/portfolio/analyze", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  holdingsSnapshot: (userId: string) =>
    j(`/portfolio/holdings/${encodeURIComponent(userId)}`),
  holdingsAdd: (
    userId: string,
    body: {
      symbol: string;
      shares: number;
      avg_cost: number;
      opened_at?: string;
    },
  ) =>
    j(`/portfolio/holdings/${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  holdingsRemove: (userId: string, symbol: string) =>
    j(
      `/portfolio/holdings/${encodeURIComponent(userId)}/${encodeURIComponent(symbol)}`,
      { method: "DELETE" },
    ),
  /** MV-weighted period returns (1m, ytd, 1y, 5y) from yfinance adjusted closes. */
  portfolioPerformance: (userId: string) =>
    j(`/portfolio/holdings/${encodeURIComponent(userId)}/performance`),
  insight: (data: unknown) =>
    j("/ai/insight", {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  aiPortfolioAnalysis: (userId: string) =>
    j(`/ai/portfolio-analysis/${encodeURIComponent(userId)}`),
  aiNewsSummary: (userId?: string) =>
    userId
      ? j(`/ai/news-summary?user_id=${encodeURIComponent(userId)}`)
      : j("/ai/news-summary"),
  aiStrategy: (userId: string) =>
    j(`/ai/strategy-suggestions/${encodeURIComponent(userId)}`),
  /** Real holdings: AI education / research framing (not trade advice). */
  aiHoldingsCoach: (userId: string) =>
    j(`/ai/holdings-coach/${encodeURIComponent(userId)}`),
  explainWhy: (context: Record<string, unknown>) =>
    j("/ai/explain", {
      method: "POST",
      body: JSON.stringify({ context }),
    }),
  /** Gemini chatbot — returns { reply } or { error }. */
  aiChat: (question: string) =>
    j("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  marketCrossAsset: () => j("/market/cross-asset"),
  tradePortfolio: (userId: string) =>
    j(`/trade/portfolio/${encodeURIComponent(userId)}`),
  tradeBuy: (body: Record<string, unknown>) =>
    j("/trade/buy", { method: "POST", body: JSON.stringify(body) }),
  tradeSell: (body: Record<string, unknown>) =>
    j("/trade/sell", { method: "POST", body: JSON.stringify(body) }),
  tradeLeaderboard: () => j("/trade/leaderboard"),
  tradeAiFeedback: (userId: string) =>
    j(`/trade/ai-feedback/${encodeURIComponent(userId)}`),
  learnModules: () => j("/learn/modules"),
  learnModule: (id: string) =>
    j(`/learn/module/${encodeURIComponent(id)}`),
  learnQuiz: (id: string) =>
    j(`/learn/quiz/${encodeURIComponent(id)}`),
  learnSubmitQuiz: (id: string, answers: number[]) =>
    j(`/learn/quiz/${encodeURIComponent(id)}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  learnCertificate: (userId: string, moduleId: string) =>
    j(
      `/learn/certificate/${encodeURIComponent(userId)}/${encodeURIComponent(moduleId)}`,
    ),
  /** Module-scoped LLM tutor (financial education; uses Gemini/OpenAI when configured). */
  learnTutor: (moduleId: string, question: string) =>
    j("/learn/tutor", {
      method: "POST",
      body: JSON.stringify({ module_id: moduleId, question }),
    }),
  clerkConfig: () => j<{ publishable_key?: string }>("/auth/clerk-config"),
  integrationStatus: () =>
    j<Record<string, boolean>>("/auth/integration-status"),
  health: () =>
    j<{
      status?: string;
      market_ohlc?: boolean;
      market_ohlc_api_prefix?: boolean;
      market_quotes_provider?: string;
      news_pipeline?: string;
      market_cross_asset?: boolean;
      ai_explain?: boolean;
    }>("/health"),
  triggerAlert: (payload: Record<string, unknown>) =>
    j("/alerts/trigger", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  alertRisk: (userId: string, payload?: Record<string, unknown>) =>
    j(`/alerts/risk/${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }),
  alertSend: (payload: Record<string, unknown>) =>
    j("/alerts/send", { method: "POST", body: JSON.stringify(payload) }),
};

export async function postVoice(text: string): Promise<Blob> {
  const r = await fetch(`${base}/voice/generate`, await withAuth({
    method: "POST",
    body: JSON.stringify({ text }),
  }));
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(errText || r.statusText);
  }
  if (!ct.includes("mpeg") && !ct.includes("audio")) {
    const errText = await r.text();
    throw new Error(errText || "Response is not audio");
  }
  return r.blob();
}

export async function postMarketAudioSummary(context: unknown): Promise<Blob> {
  const r = await fetch(`${base}/market/audio-summary`, await withAuth({
    method: "POST",
    body: JSON.stringify({ context }),
  }));
  if (!r.ok) throw new Error(await r.text());
  return r.blob();
}

export type PodcastSession = "open" | "close";

export async function getMarketPodcastLatest(session: PodcastSession = "close"): Promise<{
  audio: Blob;
  generatedAt?: string | null;
}> {
  const r = await fetch(
    `${base}/market/podcast/latest?session=${encodeURIComponent(session)}`,
    await withAuth({ method: "GET" }),
  );
  if (!r.ok) throw new Error(await r.text());
  return { audio: await r.blob(), generatedAt: r.headers.get("X-Generated-At") };
}

export async function getMarketPodcastLatestScript(session: PodcastSession = "close"): Promise<{
  generatedAt?: string | null;
  script: string;
}> {
  const r = await fetch(
    `${base}/market/podcast/latest-script?session=${encodeURIComponent(session)}`,
    await withAuth({ method: "GET" }),
  );
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { generatedAt?: string | null; script: string };
}

export async function postMarketPodcastGenerate(session: PodcastSession = "close"): Promise<{
  status?: string;
  generated_at?: string | null;
  session?: string;
}> {
  return j(`/market/podcast/generate?session=${encodeURIComponent(session)}`, {
    method: "POST",
  });
}

export async function postAiAudioSummary(body: Record<string, unknown>): Promise<Blob> {
  const r = await fetch(`${base}/ai/audio-summary`, await withAuth({
    method: "POST",
    body: JSON.stringify(body),
  }));
  if (!r.ok) throw new Error(await r.text());
  return r.blob();
}

export async function postLearnModuleAudio(
  moduleId: string,
  body?: Record<string, unknown>,
): Promise<Blob | { error?: string }> {
  const r = await fetch(
    `${base}/learn/audio/${encodeURIComponent(moduleId)}`,
    await withAuth({
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  );
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) {
    try {
      return (await r.json()) as { error?: string };
    } catch {
      throw new Error(await r.text());
    }
  }
  if (ct.includes("json")) {
    return (await r.json()) as { error?: string };
  }
  return r.blob();
}
