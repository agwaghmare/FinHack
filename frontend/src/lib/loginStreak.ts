/** Per-user daily login streak (local calendar days), stored in localStorage. */

const STORAGE_KEY = "fs.login_streak.v1";

type StreakPayload = {
  userId: string;
  lastDate: string;
  streak: number;
};

function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(s: string): Date {
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function dayDiff(fromYmd: string, toYmd: string): number {
  const a = parseYMD(fromYmd).getTime();
  const b = parseYMD(toYmd).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Call once per session when the user lands on a tracked page (e.g. Market Pulse).
 * Updates streak for consecutive local calendar days of visits.
 */
export function updateLoginStreak(userId: string): { streak: number } {
  if (!userId) return { streak: 0 };
  const today = localYMD(new Date());
  let raw: StreakPayload | null = null;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) raw = JSON.parse(s) as StreakPayload;
  } catch {
    raw = null;
  }

  if (!raw || raw.userId !== userId) {
    const next: StreakPayload = { userId, lastDate: today, streak: 1 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { streak: 1 };
  }

  if (raw.lastDate === today) {
    return { streak: Math.max(1, raw.streak) };
  }

  const gap = dayDiff(raw.lastDate, today);
  let streak = raw.streak;
  if (gap === 1) {
    streak += 1;
  } else {
    streak = 1;
  }

  const next: StreakPayload = { userId, lastDate: today, streak };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { streak };
}
