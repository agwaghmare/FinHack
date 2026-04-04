/** Illustrative cross-asset stress math (education only — not a portfolio model). */

export type StressInputs = {
  oilShockPct: number;
  usdShockRank: number;
  ratesShockBp: number;
};

export type StressOutputs = {
  stressedOil: number;
  portfolioProxy: number;
  agProxy: number;
};

export const ETF_AG_PROXIES = ["GLD", "SLV", "DBA", "USO", "CORN", "WEAT"] as const;

/**
 * @param baseOil - spot WTI (or fallback)
 * @param macroFedFundsPct - Fed funds % from macro API (optional, tweaks energy drag)
 */
export function computeCrossAssetStress(
  baseOil: number,
  macroFedFundsPct: number | null | undefined,
  { oilShockPct, usdShockRank, ratesShockBp }: StressInputs,
): StressOutputs {
  const oilFactor = 1 + oilShockPct / 100;
  const stressedOil = baseOil * oilFactor;
  const usdFactor = 1 - usdShockRank / 400;
  const ratesBps = ratesShockBp;
  const energyBeta = 0.38;
  const usdCommodityBeta = -0.22;
  const ratesDrag = ratesBps * -0.00015;
  const macroRates =
    macroFedFundsPct != null && Number.isFinite(macroFedFundsPct) && macroFedFundsPct > 4 ? -0.015 : 0;
  const portfolioProxy =
    100 *
    (1 +
      energyBeta * (oilFactor - 1) +
      usdCommodityBeta * (usdFactor - 1) +
      ratesDrag +
      macroRates);
  const agProxy =
    100 * (1 + (oilFactor - 1) * 0.12 + usdCommodityBeta * (usdFactor - 1) * 0.8);
  return { stressedOil, portfolioProxy, agProxy };
}
