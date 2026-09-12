"""Simple educational strategy backtester (not investment advice)."""

from __future__ import annotations

from typing import Any, Literal

import numpy as np
import yfinance as yf

StrategyId = Literal["buy_hold", "sma_cross", "rsi_mean_reversion", "donchian_breakout"]


def _closes(symbol: str, period: str) -> Any:
    hist = yf.Ticker(symbol).history(period=period, auto_adjust=True)
    if hist is None or hist.empty or "Close" not in hist.columns:
        return None
    s = hist["Close"].dropna()
    return s if len(s) >= 60 else None


def _rsi(closes: Any, period: int = 14) -> Any:
    delta = closes.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _signals(closes: Any, strategy: str, params: dict) -> Any:
    """Return +1 long / 0 flat series aligned to closes index."""
    idx = closes.index
    sig = np.zeros(len(closes), dtype=float)

    if strategy == "buy_hold":
        sig[:] = 1.0
        return sig

    if strategy == "sma_cross":
        fast = int(params.get("fast", 20))
        slow = int(params.get("slow", 50))
        if fast >= slow:
            fast, slow = 20, 50
        sma_f = closes.rolling(fast).mean()
        sma_s = closes.rolling(slow).mean()
        sig = np.where(sma_f > sma_s, 1.0, 0.0)
        # warm-up
        sig[: slow] = 0.0
        return sig

    if strategy == "rsi_mean_reversion":
        period = int(params.get("rsi_period", 14))
        low = float(params.get("rsi_low", 30))
        high = float(params.get("rsi_high", 70))
        rsi = _rsi(closes, period)
        # Enter long when RSI crosses up through low; exit when crosses down through high
        position = 0.0
        out = []
        prev = float("nan")
        for v in rsi.fillna(50).values:
            if position == 0 and prev <= low < v:
                position = 1.0
            elif position == 1 and prev >= high > v:
                position = 0.0
            out.append(position)
            prev = v
        return np.array(out, dtype=float)

    if strategy == "donchian_breakout":
        look = int(params.get("channel", 20))
        hi = closes.rolling(look).max().shift(1)
        lo = closes.rolling(look).min().shift(1)
        position = 0.0
        out = []
        for i, px in enumerate(closes.values):
            if i < look + 1 or np.isnan(hi.iloc[i]) or np.isnan(lo.iloc[i]):
                out.append(0.0)
                continue
            if px >= hi.iloc[i]:
                position = 1.0
            elif px <= lo.iloc[i]:
                position = 0.0
            out.append(position)
        return np.array(out, dtype=float)

    # fallback
    sig[:] = 1.0
    return sig


def run_backtest(
    symbol: str,
    strategy: StrategyId = "sma_cross",
    period: str = "2y",
    initial_cash: float = 10_000.0,
    params: dict | None = None,
) -> dict:
    symbol = (symbol or "SPY").upper().strip()
    params = params or {}
    closes = _closes(symbol, period)
    if closes is None:
        return {
            "ok": False,
            "error": f"Not enough price history for {symbol}. Try another ticker or longer period.",
        }

    sig = _signals(closes, strategy, params)
    # Trade on next open ≈ next close for simplicity (educational)
    position = np.roll(sig, 1)
    position[0] = 0.0

    rets = closes.pct_change().fillna(0.0).values
    strat_rets = position * rets
    equity = initial_cash * np.cumprod(1.0 + strat_rets)
    bh_equity = initial_cash * np.cumprod(1.0 + rets)

    # Trade list: when position changes
    trades: list[dict] = []
    prev_pos = 0.0
    for i in range(1, len(position)):
        if position[i] != prev_pos:
            side = "buy" if position[i] > prev_pos else "sell"
            trades.append(
                {
                    "date": str(closes.index[i].date()),
                    "side": side,
                    "price": round(float(closes.iloc[i]), 4),
                    "position": float(position[i]),
                }
            )
            prev_pos = float(position[i])

    # Metrics
    days = max(len(closes) - 1, 1)
    years = days / 252.0
    final = float(equity[-1])
    bh_final = float(bh_equity[-1])
    cagr = (final / initial_cash) ** (1 / years) - 1 if years > 0 and final > 0 else 0.0
    bh_cagr = (bh_final / initial_cash) ** (1 / years) - 1 if years > 0 and bh_final > 0 else 0.0

    peak = np.maximum.accumulate(equity)
    dd = (equity - peak) / peak
    max_dd = float(dd.min()) if len(dd) else 0.0

    vol = float(np.std(strat_rets, ddof=1) * np.sqrt(252)) if len(strat_rets) > 2 else 0.0
    mean = float(np.mean(strat_rets) * 252)
    sharpe = (mean / vol) if vol > 1e-9 else 0.0

    # Win rate on round trips (sell after buy)
    wins = 0
    rounds = 0
    entry_px = None
    for t in trades:
        if t["side"] == "buy":
            entry_px = t["price"]
        elif t["side"] == "sell" and entry_px is not None:
            rounds += 1
            if t["price"] > entry_px:
                wins += 1
            entry_px = None
    win_rate = (wins / rounds) if rounds else None

    # Downsample equity curve for chart (~120 pts)
    step = max(1, len(equity) // 120)
    curve = [
        {
            "date": str(closes.index[i].date()),
            "strategy": round(float(equity[i]), 2),
            "buy_hold": round(float(bh_equity[i]), 2),
        }
        for i in range(0, len(equity), step)
    ]
    if curve and curve[-1]["date"] != str(closes.index[-1].date()):
        curve.append(
            {
                "date": str(closes.index[-1].date()),
                "strategy": round(final, 2),
                "buy_hold": round(bh_final, 2),
            }
        )

    return {
        "ok": True,
        "symbol": symbol,
        "strategy": strategy,
        "period": period,
        "params": params,
        "initial_cash": initial_cash,
        "metrics": {
            "final_equity": round(final, 2),
            "total_return_pct": round((final / initial_cash - 1) * 100, 2),
            "cagr_pct": round(cagr * 100, 2),
            "buy_hold_cagr_pct": round(bh_cagr * 100, 2),
            "max_drawdown_pct": round(max_dd * 100, 2),
            "sharpe": round(sharpe, 2),
            "trades": len(trades),
            "round_trips": rounds,
            "win_rate_pct": round(win_rate * 100, 1) if win_rate is not None else None,
            "bars": int(len(closes)),
        },
        "equity_curve": curve,
        "trades": trades[-40:],
        "disclaimer": (
            "Educational backtest with next-bar fills and no fees/slippage. "
            "Past results do not predict future performance. Not investment advice."
        ),
    }


STRATEGIES_META = [
    {
        "id": "buy_hold",
        "name": "Buy & hold",
        "blurb": "Stay fully invested - the baseline every active idea must beat.",
        "params": [],
    },
    {
        "id": "sma_cross",
        "name": "SMA crossover",
        "blurb": "Long when the fast moving average is above the slow one; flat otherwise.",
        "params": [
            {"key": "fast", "label": "Fast SMA", "default": 20, "min": 5, "max": 50},
            {"key": "slow", "label": "Slow SMA", "default": 50, "min": 20, "max": 200},
        ],
    },
    {
        "id": "rsi_mean_reversion",
        "name": "RSI mean reversion",
        "blurb": "Buy after RSI exits oversold; exit after it leaves overbought.",
        "params": [
            {"key": "rsi_period", "label": "RSI period", "default": 14, "min": 5, "max": 30},
            {"key": "rsi_low", "label": "Oversold", "default": 30, "min": 10, "max": 40},
            {"key": "rsi_high", "label": "Overbought", "default": 70, "min": 60, "max": 90},
        ],
    },
    {
        "id": "donchian_breakout",
        "name": "Donchian breakout",
        "blurb": "Trend-follow: long on N-day high breakout; flat on N-day low.",
        "params": [
            {"key": "channel", "label": "Channel days", "default": 20, "min": 10, "max": 55},
        ],
    },
]
