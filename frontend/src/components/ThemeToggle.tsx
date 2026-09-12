import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white/80 dark:text-zinc-200 dark:hover:bg-white/10"
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
