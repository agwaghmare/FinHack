import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Mode = "light" | "dark";

type Ctx = {
  mode: Mode;
  toggle: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "dark";
    const s = localStorage.getItem("theme") as Mode | null;
    if (s === "light" || s === "dark") return s;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    localStorage.setItem("theme", mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => (m === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
