import { useUser } from "@clerk/clerk-react";
import { Flame, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { updateLoginStreak } from "../lib/loginStreak";

export function LoginStreakBanner() {
  const { user, isLoaded } = useUser();
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setStreak(null);
      return;
    }
    const { streak: s } = updateLoginStreak(user.id);
    setStreak(s);
  }, [user?.id]);

  if (!isLoaded || !user || streak === null) return null;

  const first =
    user.firstName?.trim() ||
    user.username?.trim() ||
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "there";
  const dayWord = streak === 1 ? "day" : "days";

  return (
    <div className="login-streak-banner group relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-500/[0.12] via-orange-400/[0.08] to-amber-500/[0.12] px-4 py-3.5 shadow-lg shadow-amber-900/10 dark:shadow-amber-950/30">
      <div className="login-streak-shimmer pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="login-streak-icon flex shrink-0 items-center justify-center">
          <div className="relative">
            <Flame
              className="h-9 w-9 text-amber-500 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <Sparkles
              className="login-streak-sparkle absolute -right-1 -top-1 h-4 w-4 text-amber-200"
              aria-hidden
            />
          </div>
        </div>
        <p className="min-w-0 flex-1 text-sm leading-snug text-zinc-800 dark:text-zinc-100">
          Good job,{" "}
          <span className="font-semibold text-amber-700 dark:text-amber-300">{first}</span>,{" "}
          you&apos;re on a{" "}
          <span className="inline-flex items-baseline gap-1 font-bold tabular-nums text-amber-600 dark:text-amber-400">
            <span key={streak} className="login-streak-num text-lg">
              {streak}
            </span>
            <span className="text-sm font-semibold">{dayWord}</span>
          </span>{" "}
          logged-in streak!
        </p>
      </div>
    </div>
  );
}
