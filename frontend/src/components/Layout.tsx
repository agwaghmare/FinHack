import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { TrackFinanceProvider } from "../context/TrackFinanceContext";
import { DigestReminder } from "./DigestReminder";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem("fs.sidebar.collapsed");
      if (v === "1") setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("fs.sidebar.collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  return (
    <TrackFinanceProvider>
      <div className="relative min-h-full overflow-x-hidden">
        {/* Atmospheric layers so frosted glass has something to refract */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100/80 via-white to-violet-100/70 dark:from-zinc-950 dark:via-black dark:to-emerald-950/40" />
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-300/40 blur-3xl dark:bg-sky-600/20" />
          <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-violet-300/35 blur-3xl dark:bg-violet-700/15" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-700/15" />
        </div>

        <DigestReminder />
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((p) => !p)} />
        <main className={sidebarCollapsed ? "pl-20" : "pl-72"}>
          <div className="sticky top-0 z-30 flex justify-end px-3 pt-3 sm:px-5 lg:px-8">
            <ThemeToggle />
          </div>
          <div className="mx-auto w-full max-w-none px-3 pb-10 pt-4 sm:px-5 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </TrackFinanceProvider>
  );
}
