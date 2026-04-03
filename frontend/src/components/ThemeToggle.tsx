import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 shadow-soft transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:border-zinc-600"
      aria-label="Toggle color mode"
    >
      {mode === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      {mode === "dark" ? "Light" : "Dark"} mode
    </button>
  );
}
