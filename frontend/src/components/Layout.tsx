import { Outlet } from "react-router-dom";
import { DigestReminder } from "./DigestReminder";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="min-h-full bg-gradient-to-br from-zinc-100 via-white to-zinc-100 dark:from-black dark:via-zinc-950 dark:to-black">
      <DigestReminder />
      <Sidebar />
      <main className="pl-72">
        <div className="mx-auto max-w-6xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
