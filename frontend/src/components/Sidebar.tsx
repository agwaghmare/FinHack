import { NavLink, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import {
  Activity,
  BellRing,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Gem,
  Settings,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { useClerkEnabled } from "./ClerkAuth";

const groups = [
  {
    to: "/pulse",
    label: "Market Pulse",
    hint: "Live tape, sentiment, and research context — see how markets move before you size a view.",
    icon: Activity,
  },
  {
    to: "/portfolio",
    label: "My portfolio",
    hint: "Real positions with live marks; AI can coach on diversification and research next steps (not trade orders).",
    icon: Wallet,
  },
  { to: "/paper-lab", label: "Paper Lab", hint: "Simulated trades, P&L, and leaderboard — experiment without capital risk.", icon: FlaskConical },
  {
    to: "/insights",
    label: "Insights",
    hint: "AI summaries on news & paper portfolio, plus cross-asset chains — investment research support in plain English.",
    icon: Brain,
  },
  {
    to: "/macro-regime",
    label: "Macro Regime",
    hint: "Oil, metals, ag proxies, macro context. Cross-asset stress lab lives on Learn.",
    icon: Gem,
  },
  {
    to: "/learn",
    label: "Learn Hub",
    hint: "Modules, quizzes, certificates, and an AI tutor for financial education & inclusion.",
    icon: BookOpen,
  },
  { to: "/alerts", label: "Alerts Center", hint: "Risk signals with SMS, email, or an optional HTTP endpoint.", icon: BellRing },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const clerkOn = useClerkEnabled();
  const location = useLocation();

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 flex h-full flex-col border-r border-zinc-700/80 bg-zinc-950 py-6 shadow-[4px_0_24px_rgba(0,0,0,0.35)] transition-all",
        collapsed ? "w-20 px-2" : "w-72 pl-5 pr-3",
      )}
    >
      <div className={clsx("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between px-2")}>
        <div className={clsx("flex items-center gap-2", collapsed && "justify-center")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-600 to-zinc-800 text-white shadow-lg ring-1 ring-zinc-500/50">
            <Activity className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                FinSight
              </p>
              <p className="text-sm font-semibold tracking-tight text-zinc-100">Education · Research</p>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={onToggle}
          className="mb-5 mx-auto rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}

      {clerkOn && !collapsed ? (
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
      ) : null}

      {!clerkOn && !collapsed ? (
        <p className="mb-5 px-2 text-[11px] leading-snug text-zinc-500">
          Add Clerk keys to enable sign-in.
        </p>
      ) : null}

      <nav className={clsx("flex flex-1 flex-col gap-1.5 overflow-y-auto", collapsed ? "" : "pr-1")}>
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
                  "group flex items-center rounded-xl text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive || pathActive
                    ? "border border-zinc-600/80 bg-zinc-800/50 text-zinc-50"
                    : "border border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              {!collapsed ? <span className="truncate">{g.label}</span> : null}
            </NavLink>
          );
        })}
      </nav>

      <div className={clsx("mt-auto border-t border-zinc-800 pt-5", collapsed ? "space-y-2" : "space-y-3")}>
        <NavLink
          to="/settings"
          title="API URLs, preferences, and keys"
          className={({ isActive }) =>
            clsx(
              "flex items-center rounded-xl text-xs font-medium transition",
              collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
              isActive
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300",
            )
          }
        >
          <Settings className="h-3.5 w-3.5" />
          {!collapsed ? "Settings" : null}
        </NavLink>
        {!collapsed ? (
          <p className="px-1 text-[10px] leading-relaxed text-zinc-600">
            Demo data · Not investment advice
          </p>
        ) : null}
      </div>
    </aside>
  );
}
