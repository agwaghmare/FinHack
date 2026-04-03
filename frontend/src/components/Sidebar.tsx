import { NavLink, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import {
  Activity,
  BellRing,
  BookOpen,
  Brain,
  FlaskConical,
  Gem,
  Settings,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { useClerkEnabled } from "./ClerkAuth";

const groups = [
  { to: "/pulse", label: "Market Pulse", hint: "Real-time stocks, crypto, ETFs, and macro in one live view.", icon: Activity },
  { to: "/portfolio", label: "My portfolio", hint: "Track real positions: basis, return, and CAGR from your holdings.", icon: Wallet },
  { to: "/paper-lab", label: "Paper Lab", hint: "Simulated trades, P&L, and leaderboard — experiment without capital risk.", icon: FlaskConical },
  { to: "/insights", label: "Insights", hint: "GNews & Yahoo headlines, Gemini summaries, and strategy notes in plain English.", icon: Brain },
  { to: "/commodities", label: "Commodity Lens", hint: "Oil, metals, ag proxies, macro context, and what-if stress paths.", icon: Gem },
  { to: "/learn", label: "Learn Hub", hint: "Interactive modules, quizzes, and demo certificates.", icon: BookOpen },
  { to: "/alerts", label: "Alerts Center", hint: "Risk, news, and webhook tests — your actionable signal inbox.", icon: BellRing },
];

export function Sidebar() {
  const clerkOn = useClerkEnabled();
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-zinc-700/80 bg-zinc-950 py-8 pl-5 pr-3 shadow-[4px_0_24px_rgba(0,0,0,0.35)]">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-600 to-zinc-800 text-white shadow-lg ring-1 ring-zinc-500/50">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            FinSight
          </p>
          <p className="text-sm font-semibold tracking-tight text-zinc-100">Terminal</p>
        </div>
      </div>

      {clerkOn ? (
        <div className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-zinc-700/60 bg-zinc-900/80 px-3 py-2">
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900"
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="flex w-full items-center justify-between gap-2">
              <span className="truncate text-xs text-zinc-500">Account</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      ) : (
        <p className="mb-5 px-2 text-[11px] leading-snug text-zinc-500">
          Add Clerk keys to enable sign-in.
        </p>
      )}

      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {groups.map((g) => {
          const Icon = g.icon;
          const pathActive =
            location.pathname === g.to || location.pathname.startsWith(`${g.to}/`);
          return (
            <NavLink
              key={g.to}
              to={g.to}
              title={g.hint}
              className={({ isActive }) =>
                clsx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive || pathActive
                    ? "border border-zinc-600/80 bg-zinc-800/50 text-zinc-50"
                    : "border border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              <span className="truncate">{g.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 border-t border-zinc-800 pt-5">
        <NavLink
          to="/settings"
          title="API URLs, preferences, and keys"
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition",
              isActive
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300",
            )
          }
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </NavLink>
        <p className="px-1 text-[10px] leading-relaxed text-zinc-600">
          Demo data · Not investment advice
        </p>
      </div>
    </aside>
  );
}
