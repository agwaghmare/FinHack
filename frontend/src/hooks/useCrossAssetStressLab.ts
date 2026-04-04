import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { computeCrossAssetStress, type StressInputs } from "../lib/crossAssetStress";

type Quote = { kind?: string; symbol?: string; price?: number; error?: string };

export type LockMode = "all" | "usd_rates" | "oil_usd" | "oil_rates";

function locksFor(mode: LockMode): { oil: boolean; usd: boolean; rates: boolean } {
  switch (mode) {
    case "usd_rates":
      return { oil: true, usd: false, rates: false };
    case "oil_usd":
      return { oil: false, usd: false, rates: true };
    case "oil_rates":
      return { oil: false, usd: true, rates: false };
    default:
      return { oil: false, usd: false, rates: false };
  }
}

export function useCrossAssetStressLab() {
  const [macroRates, setMacroRates] = useState<number | null>(null);
  const [baseOil, setBaseOil] = useState(75);
  const [loading, setLoading] = useState(true);
  const [oilShock, setOilShock] = useState(0);
  const [usdShock, setUsdShock] = useState(0);
  const [ratesShock, setRatesShock] = useState(0);
  const [lockMode, setLockMode] = useState<LockMode>("usd_rates");

  const locked = locksFor(lockMode);

  useEffect(() => {
    const L = locksFor(lockMode);
    if (L.oil) setOilShock(0);
    if (L.usd) setUsdShock(0);
    if (L.rates) setRatesShock(0);
  }, [lockMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, px] = await Promise.all([
          api.marketMacro(),
          api.marketPrices("WTI,GLD,SLV,DBA,USO,SPY,EURUSD,USDJPY,GBPUSD"),
        ]);
        if (cancelled) return;
        const mm = m as { rates?: number };
        setMacroRates(typeof mm.rates === "number" ? mm.rates : null);
        const quotes = (px as { quotes?: Quote[] }).quotes ?? [];
        const wti = quotes.find((q) => (q.symbol ?? "").includes("WTI") || q.kind === "commodity");
        const bo = typeof wti?.price === "number" ? wti.price : 75;
        setBaseOil(bo);
      } catch {
        if (!cancelled) setMacroRates(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inputs: StressInputs = useMemo(() => {
    const L = locksFor(lockMode);
    return {
      oilShockPct: L.oil ? 0 : oilShock,
      usdShockRank: L.usd ? 0 : usdShock,
      ratesShockBp: L.rates ? 0 : ratesShock,
    };
  }, [lockMode, oilShock, usdShock, ratesShock]);

  const scenario = useMemo(
    () => computeCrossAssetStress(baseOil, macroRates, inputs),
    [baseOil, macroRates, inputs],
  );

  return {
    loading,
    locked,
    lockMode,
    setLockMode,
    oilShock,
    setOilShock,
    usdShock,
    setUsdShock,
    ratesShock,
    setRatesShock,
    scenario,
  };
}

export type CrossAssetStressLabModel = ReturnType<typeof useCrossAssetStressLab>;
