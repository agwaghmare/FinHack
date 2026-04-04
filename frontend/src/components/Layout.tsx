import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { DigestReminder } from "./DigestReminder";
import { Sidebar } from "./Sidebar";

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
    <div className="min-h-full bg-gradient-to-br from-zinc-100 via-white to-zinc-100 dark:from-black dark:via-zinc-950 dark:to-black">
      <DigestReminder />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((p) => !p)} />
      <main className={sidebarCollapsed ? "pl-20" : "pl-72"}>
        <div className="mx-auto max-w-6xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
