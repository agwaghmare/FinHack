/** Browser watchlist for Market Pulse — keyed by Clerk user id or `guest`. */

const PREFIX = "finsight_watchlist_v1";

function notifyWatchlist() {
  try {
    window.dispatchEvent(new CustomEvent("finsight-watchlist"));
  } catch {
    /* ignore */
  }
}

function key(userId: string | undefined) {
  return `${PREFIX}_${userId || "guest"}`;
}

export function getWatchlist(userId: string | undefined): string[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
      .filter(Boolean)
      .slice(0, 40);
  } catch {
    return [];
  }
}

export function setWatchlist(userId: string | undefined, symbols: string[]) {
  const clean = Array.from(
    new Set(
      symbols
        .map((s) => s.toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
        .filter(Boolean),
    ),
  ).slice(0, 40);
  try {
    localStorage.setItem(key(userId), JSON.stringify(clean));
  } catch {
    /* ignore */
  }
  notifyWatchlist();
  return clean;
}

export function addWatchlistSymbol(userId: string | undefined, symbol: string): string[] {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (!s) return getWatchlist(userId);
  const cur = getWatchlist(userId);
  if (cur.includes(s)) return cur;
  return setWatchlist(userId, [...cur, s]);
}

export function removeWatchlistSymbol(userId: string | undefined, symbol: string): string[] {
  const s = symbol.toUpperCase();
  return setWatchlist(
    userId,
    getWatchlist(userId).filter((x) => x !== s),
  );
}
