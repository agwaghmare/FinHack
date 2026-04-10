import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type TrackFinanceState,
  type TrackGoal,
  type TrackMortgage,
  type TrackSubscription,
  type TrackTax,
  type TrackTransaction,
  defaultTrackFinanceState,
  loadTrackFinanceState,
  saveTrackFinanceState,
} from "../lib/trackFinance";

type TrackFinanceContextValue = {
  state: TrackFinanceState;
  setMonthlyIncome: (n: number) => void;
  setEmergency: (target: number, balance: number) => void;
  setDebtPayments: (n: number) => void;
  addTransaction: (t: Omit<TrackTransaction, "id">) => void;
  updateBudget: (category: TrackTransaction["category"], monthlyLimit: number) => void;
  updateSubscription: (id: string, patch: Partial<TrackSubscription>) => void;
  updateGoal: (id: string, patch: Partial<TrackGoal>) => void;
  addGoal: (goal: Omit<TrackGoal, "id">) => void;
  removeGoal: (id: string) => void;
  setMortgage: (m: Partial<TrackMortgage>) => void;
  setTax: (t: Partial<TrackTax>) => void;
  resetToDemo: () => void;
};

const TrackFinanceContext = createContext<TrackFinanceContextValue | null>(null);

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export function TrackFinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrackFinanceState>(() => loadTrackFinanceState());

  useEffect(() => {
    saveTrackFinanceState(state);
  }, [state]);

  const setMonthlyIncome = useCallback((n: number) => {
    setState((s) => ({ ...s, monthlyIncome: Math.max(0, n) }));
  }, []);

  const setEmergency = useCallback((target: number, balance: number) => {
    setState((s) => ({
      ...s,
      emergencyFundTarget: Math.max(0, target),
      emergencyFundBalance: Math.max(0, balance),
    }));
  }, []);

  const setDebtPayments = useCallback((n: number) => {
    setState((s) => ({ ...s, monthlyDebtPayments: Math.max(0, n) }));
  }, []);

  const addTransaction = useCallback((t: Omit<TrackTransaction, "id">) => {
    setState((s) => ({
      ...s,
      transactions: [{ ...t, id: newId("tx") }, ...s.transactions],
    }));
  }, []);

  const updateBudget = useCallback((category: TrackTransaction["category"], monthlyLimit: number) => {
    setState((s) => {
      const rest = s.budgets.filter((b) => b.category !== category);
      return {
        ...s,
        budgets: [...rest, { category, monthlyLimit: Math.max(0, monthlyLimit) }].sort((a, b) =>
          a.category.localeCompare(b.category),
        ),
      };
    });
  }, []);

  const updateSubscription = useCallback((id: string, patch: Partial<TrackSubscription>) => {
    setState((s) => ({
      ...s,
      subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, []);

  const updateGoal = useCallback((id: string, patch: Partial<TrackGoal>) => {
    if (patch.title !== undefined && !String(patch.title).trim()) return;
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== id) return g;
        const next: TrackGoal = { ...g, ...patch };
        if (patch.title !== undefined) next.title = patch.title.trim();
        return next;
      }),
    }));
  }, []);

  const addGoal = useCallback((goal: Omit<TrackGoal, "id">) => {
    const title = goal.title.trim();
    if (!title) return;
    setState((s) => ({
      ...s,
      goals: [
        ...s.goals,
        {
          id: newId("goal"),
          title,
          targetAmount: Math.max(0, goal.targetAmount),
          currentAmount: Math.max(0, goal.currentAmount),
          monthlyContribution: Math.max(0, goal.monthlyContribution),
        },
      ],
    }));
  }, []);

  const removeGoal = useCallback((id: string) => {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  }, []);

  const setMortgage = useCallback((m: Partial<TrackMortgage>) => {
    setState((s) => ({ ...s, mortgage: { ...s.mortgage, ...m } }));
  }, []);

  const setTax = useCallback((t: Partial<TrackTax>) => {
    setState((s) => ({ ...s, tax: { ...s.tax, ...t } }));
  }, []);

  const resetToDemo = useCallback(() => {
    try {
      localStorage.removeItem("fs.trackFinance.v1");
    } catch {
      /* ignore */
    }
    setState(defaultTrackFinanceState());
  }, []);

  const value = useMemo(
    () => ({
      state,
      setMonthlyIncome,
      setEmergency,
      setDebtPayments,
      addTransaction,
      updateBudget,
      updateSubscription,
      updateGoal,
      addGoal,
      removeGoal,
      setMortgage,
      setTax,
      resetToDemo,
    }),
    [
      state,
      setMonthlyIncome,
      setEmergency,
      setDebtPayments,
      addTransaction,
      updateBudget,
      updateSubscription,
      updateGoal,
      addGoal,
      removeGoal,
      setMortgage,
      setTax,
      resetToDemo,
    ],
  );

  return <TrackFinanceContext.Provider value={value}>{children}</TrackFinanceContext.Provider>;
}

export function useTrackFinance() {
  const ctx = useContext(TrackFinanceContext);
  if (!ctx) throw new Error("useTrackFinance must be used within TrackFinanceProvider");
  return ctx;
}
