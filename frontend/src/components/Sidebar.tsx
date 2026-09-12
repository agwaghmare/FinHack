import { NavLink, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import {
  Activity,
  Calculator,
  BellRing,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  CandlestickChart,
  Gem,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Repeat,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { useClerkEnabled } from "./ClerkAuth";

const investGroups = [
  {
    to: "/invest/pulse",
    label: "Market Pulse",
    hint: "Live tape, sentiment, and research context — see how markets move before you size a view.",
    icon: Activity,
  },
  {
    to: "/invest/portfolio",
    label: "My portfolio",
    hint: "Real positions with live marks; AI can coach on diversification and research next steps (not trade orders).",
    icon: Wallet,
  },
  { to: "/invest/paper-lab", label: "Paper Lab", hint: "Simulated trades, P&L, and leaderboard — experiment without capital risk.", icon: FlaskConical },
  {
    to: "/invest/trading",
    label: "Trading Lab",
    hint: "Daily portfolio VaR, strategy backtests, and trading education — research tools, not live brokerage.",
    icon: CandlestickChart,
  },
  {
    to: "/invest/insights",
    label: "Insights",
    hint: "AI summaries on news & paper portfolio, plus cross-asset chains — investment research support in plain English.",
    icon: Brain,
  },
  {
    to: "/invest/macro-regime",
    label: "Macro Regime",
    hint: "Oil, metals, ag proxies, macro context. Cross-asset stress lab lives on Learn.",
    icon: Gem,
  },
  {
    to: "/invest/learn",
    label: "Learn Hub",
    hint: "Modules, quizzes, certificates, and an AI tutor for financial education & inclusion.",
    icon: BookOpen,
  },
  { to: "/invest/alerts", label: "Alerts Center", hint: "Risk signals with SMS, email, or an optional HTTP endpoint.", icon: BellRing },
];

const trackGroups = [
  {
    to: "/track/overview",
    label: "Overview",
    hint: "Health score, cash-flow snapshot, and Track → Invest prompts.",
    icon: LayoutDashboard,
  },
  {
    to: "/track/spending",
    label: "Spending",
    hint: "Category breakdown, % of income, and behavior-style insights.",
    icon: WalletCards,
  },
  {
    to: "/track/budget",
    label: "Budget",
    hint: "Budget vs actual bars and over-spend alerts.",
    icon: Calculator,
  },
  {
    to: "/track/cash-flow",
    label: "Cash flow",
    hint: "Income, expenses, net savings trend.",
    icon: TrendingUp,
  },
  {
    to: "/track/subscriptions",
    label: "Subscriptions",
    hint: "Recurring charges and monthly total.",
    icon: Repeat,
  },
  {
    to: "/track/goals",
    label: "Goals",
    hint: "Emergency fund, vacation, down payment progress.",
    icon: Target,
  },
  {
    to: "/track/mortgage",
    label: "Mortgage",
    hint: "P/I split, payoff, and extra principal impact.",
    icon: Landmark,
  },
  {
    to: "/track/taxes",
    label: "Taxes",
    hint: "Simple federal estimate — not tax advice.",
    icon: ReceiptText,
  },
  {
    to: "/track/what-if",
    label: "What-if",
    hint: "If you invest freed cash monthly, see illustrative growth.",
    icon: Sparkles,
  },
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
  const section = location.pathname.startsWith("/track") ? "track" : "invest";
  const groups = section === "track" ? trackGroups : investGroups;

  return (
    <aside
      className={clsx(
        "glass-nav fixed left-0 top-0 z-40 flex h-full flex-col py-6 text-zinc-800 transition-all dark:text-zinc-100",
        collapsed ? "w-20 px-2" : "w-72 pl-5 pr-3",
      )}
    >
      <div className={clsx("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between px-2")}>
        <div className={clsx("flex items-center gap-2", collapsed && "justify-center")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400/40 to-violet-500/40 text-zinc-900 shadow-lg ring-1 ring-white/40 backdrop-blur-md dark:from-sky-500/30 dark:to-violet-600/30 dark:text-white dark:ring-white/20">
            <Activity className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                FinSight
              </p>
              <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Education · Research
              </p>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
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
          className="glass-chip mb-5 mx-auto rounded-lg p-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}

      {clerkOn && !collapsed ? (
        <div className="glass-inset mb-5 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full rounded-lg bg-zinc-900/90 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="flex w-full items-center justify-between gap-2">
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">Account</span>
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
        {!collapsed ? (
          <div className="glass-inset mb-3 grid grid-cols-2 gap-1 rounded-xl p-1">
            <NavLink
              to="/invest/pulse"
              className={({ isActive }) =>
                clsx(
                  "rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition",
                  isActive || location.pathname.startsWith("/invest")
                    ? "bg-white/80 text-zinc-900 shadow-sm dark:bg-white/15 dark:text-white"
                    : "text-zinc-500 hover:bg-white/40 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100",
                )
              }
            >
              Invest
            </NavLink>
            <NavLink
              to="/track/overview"
              className={({ isActive }) =>
                clsx(
                  "rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition",
                  isActive || location.pathname.startsWith("/track")
                    ? "bg-white/80 text-zinc-900 shadow-sm dark:bg-white/15 dark:text-white"
                    : "text-zinc-500 hover:bg-white/40 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100",
                )
              }
            >
              Track
            </NavLink>
          </div>
        ) : null}
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
                    ? "glass-inset text-zinc-900 dark:text-zinc-50"
                    : "border border-transparent text-zinc-500 hover:bg-white/35 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" />
              {!collapsed ? <span className="truncate">{g.label}</span> : null}
            </NavLink>
          );
        })}
      </nav>

      <div
        className={clsx(
          "mt-auto border-t border-white/20 pt-5 dark:border-white/10",
          collapsed ? "space-y-2" : "space-y-3",
        )}
      >
        <NavLink
          to="/settings"
          title="API URLs, preferences, and keys"
          className={({ isActive }) =>
            clsx(
              "flex items-center rounded-xl text-xs font-medium transition",
              collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
              isActive
                ? "glass-inset text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-white/30 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-300",
            )
          }
        >
          <Settings className="h-3.5 w-3.5" />
          {!collapsed ? "Settings" : null}
        </NavLink>
        {!collapsed ? (
          <p className="px-1 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">
            Demo data · Not investment advice
          </p>
        ) : null}
      </div>
    </aside>
  );
}
