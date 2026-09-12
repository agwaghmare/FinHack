"""Static Learn section content — hackathon demo."""

LEARN_MODULES: list[dict] = [
    {
        "id": "market-basics",
        "title": "Market Basics",
        "duration_min": 12,
        "summary": "Stocks, ETFs, liquidity, and how prices move.",
        "topics": ["Orders", "Liquidity", "ETFs vs stocks"],
    },
    {
        "id": "macro-trends",
        "title": "Macro Trends",
        "duration_min": 15,
        "summary": "CPI, rates, GDP — linking data to asset prices.",
        "topics": ["Fed policy", "Inflation", "Growth"],
    },
    {
        "id": "risk-management",
        "title": "Risk Management",
        "duration_min": 14,
        "summary": "Volatility, drawdowns, and position sizing.",
        "topics": ["VaR intuition", "Diversification", "Hedging"],
    },
    {
        "id": "news-sentiment",
        "title": "News & Sentiment",
        "duration_min": 10,
        "summary": "How headlines and NLP sentiment feed into decisions.",
        "topics": ["Sentiment scores", "Noise vs signal"],
    },
    {
        "id": "paper-trading",
        "title": "Paper Trading Tips",
        "duration_min": 11,
        "summary": "Using a sandbox to test ideas without capital risk.",
        "topics": ["Discipline", "Journaling", "Metrics"],
    },
    {
        "id": "trading-mechanics",
        "title": "Trading Mechanics",
        "duration_min": 13,
        "summary": "Orders, spreads, slippage, and how execution differs from a chart click.",
        "topics": ["Order types", "Bid-ask", "Slippage", "Sessions"],
    },
    {
        "id": "strategy-design",
        "title": "Strategy Design & Backtests",
        "duration_min": 16,
        "summary": "Rules, expectancy, overfitting traps, and reading VaR vs backtest metrics.",
        "topics": ["Expectancy", "Drawdowns", "Overfitting", "VaR vs P&L"],
    },
]

QUIZZES: dict[str, list[dict]] = {
    "market-basics": [
        {
            "q": "What best describes an ETF?",
            "options": [
                "A single company's bond",
                "A basket of assets traded like a stock",
                "A bank savings account",
            ],
            "correct": 1,
        },
        {
            "q": "Higher liquidity generally means:",
            "options": [
                "Harder to trade without moving price",
                "Easier to trade at tight spreads",
                "Guaranteed profit",
            ],
            "correct": 1,
        },
        {
            "q": "A market order typically:",
            "options": [
                "Executes at the best available price now",
                "Guarantees a specific fill price",
                "Only works after hours",
            ],
            "correct": 0,
        },
        {
            "q": "A limit order:",
            "options": [
                "Executes immediately at any price",
                "Sets the max buy or min sell price you accept",
                "Is the same as a stop-loss",
            ],
            "correct": 1,
        },
        {
            "q": "The bid-ask spread reflects:",
            "options": [
                "Only company earnings",
                "The gap between what buyers pay and sellers accept",
                "Federal Reserve policy only",
            ],
            "correct": 1,
        },
        {
            "q": "Dividends are:",
            "options": [
                "Always tax-free",
                "Cash or stock distributions from some equities",
                "Paid only by bonds",
            ],
            "correct": 1,
        },
    ],
    "macro-trends": [
        {
            "q": "Rising policy rates often pressure:",
            "options": ["Long-duration assets", "Cash only", "Only commodities"],
            "correct": 0,
        },
        {
            "q": "Higher CPI inflation, all else equal, tends to:",
            "options": [
                "Reduce concern about purchasing power",
                "Signal rising prices in the basket tracked",
                "Guarantee higher stock prices",
            ],
            "correct": 1,
        },
        {
            "q": "GDP growth measures:",
            "options": [
                "Only stock market capitalization",
                "Broad economic output over a period",
                "The unemployment rate only",
            ],
            "correct": 1,
        },
        {
            "q": "The Fed's main policy rate influences:",
            "options": [
                "Only mortgage rates and nothing else",
                "Borrowing costs and conditions across the economy",
                "Only foreign exchange in Asia",
            ],
            "correct": 1,
        },
        {
            "q": "A stronger dollar versus other currencies can:",
            "options": [
                "Help U.S. exporters immediately",
                "Make imports relatively cheaper for U.S. buyers",
                "Only affect crypto",
            ],
            "correct": 1,
        },
        {
            "q": "Yield curve inversion (simplified) is often discussed because:",
            "options": [
                "It has zero historical link to recessions",
                "It can signal tighter financial conditions ahead",
                "It means stocks cannot fall",
            ],
            "correct": 1,
        },
    ],
    "risk-management": [
        {
            "q": "Position sizing should mainly reflect:",
            "options": [
                "Only how much you like the ticker",
                "Risk budget, volatility, and account size",
                "The stock's logo",
            ],
            "correct": 1,
        },
        {
            "q": "Diversification aims to:",
            "options": [
                "Eliminate all losses",
                "Reduce idiosyncratic exposure by spreading bets",
                "Concentrate in one winner",
            ],
            "correct": 1,
        },
        {
            "q": "A drawdown measures:",
            "options": [
                "Peak-to-trough decline from a high",
                "Only daily volume",
                "Dividend yield",
            ],
            "correct": 0,
        },
        {
            "q": "Volatility (e.g., standard deviation of returns) captures:",
            "options": [
                "Guaranteed return",
                "The dispersion of outcomes around the mean",
                "Only upside moves",
            ],
            "correct": 1,
        },
        {
            "q": "A simple hedge might:",
            "options": [
                "Remove all market exposure perfectly for free",
                "Offset part of an exposure with an inverse or options position",
                "Double risk automatically",
            ],
            "correct": 1,
        },
        {
            "q": "Stop-loss orders:",
            "options": [
                "Guarantee execution at the stop price in all conditions",
                "Trigger a sale (or buy) when a price is touched — gaps can skip levels",
                "Replace the need for position sizing",
            ],
            "correct": 1,
        },
    ],
    "news-sentiment": [
        {
            "q": "Sentiment scores from headlines are best treated as:",
            "options": [
                "A sole trigger to trade large",
                "One input among many — verify with fundamentals and price",
                "Always accurate",
            ],
            "correct": 1,
        },
        {
            "q": "NLP sentiment on news can be wrong when:",
            "options": [
                "Headlines are sarcastic or nuanced",
                "The article is long",
                "The market is closed on weekends",
            ],
            "correct": 0,
        },
        {
            "q": "High-frequency headline noise often:",
            "options": [
                "Should always be traded immediately",
                "Creates false signals without broader context",
                "Only affects bonds",
            ],
            "correct": 1,
        },
        {
            "q": "Aggregating sentiment across many articles can:",
            "options": [
                "Smooth out single-headline shocks",
                "Guarantee alpha",
                "Remove the need for diversification",
            ],
            "correct": 0,
        },
        {
            "q": "Earnings surprises interact with sentiment because:",
            "options": [
                "They never matter",
                "Expectations and revisions drive repricing",
                "They only affect private companies",
            ],
            "correct": 1,
        },
        {
            "q": "A contrarian uses sentiment to:",
            "options": [
                "Always fade the crowd without analysis",
                "Look for extremes that may be over-discounted or over-loved",
                "Ignore all data",
            ],
            "correct": 1,
        },
    ],
    "paper-trading": [
        {
            "q": "Paper trading is primarily for:",
            "options": [
                "Guaranteed profits later",
                "Testing process and execution without capital risk",
                "Avoiding all record-keeping",
            ],
            "correct": 1,
        },
        {
            "q": "A trading journal should capture:",
            "options": [
                "Only wins",
                "Thesis, entry, exit, and emotional notes",
                "Social media opinions only",
            ],
            "correct": 1,
        },
        {
            "q": "Slippage in live trading:",
            "options": [
                "Never happens",
                "Can differ from paper fills — plan for it",
                "Only affects crypto",
            ],
            "correct": 1,
        },
        {
            "q": "Overtrading in a sandbox can still:",
            "options": [
                "Build bad habits that carry over to real capital",
                "Never matter",
                "Replace risk management",
            ],
            "correct": 0,
        },
        {
            "q": "Metrics to track in paper mode include:",
            "options": [
                "Only the number of trades per minute",
                "Win rate, average R, max drawdown, and discipline",
                "Only follower count",
            ],
            "correct": 1,
        },
        {
            "q": "Moving from paper to real money should:",
            "options": [
                "Start with size you can afford to lose while learning",
                "Jump to full size immediately",
                "Skip brokers entirely",
            ],
            "correct": 0,
        },
    ],
    "trading-mechanics": [
        {
            "q": "A limit buy order:",
            "options": [
                "Guarantees an immediate fill at any price",
                "Sets the highest price you are willing to pay",
                "Only works in after-hours",
            ],
            "correct": 1,
        },
        {
            "q": "The bid-ask spread is wider when:",
            "options": [
                "Liquidity is thin or volatility spikes",
                "The Fed prints money",
                "You use a market order",
            ],
            "correct": 0,
        },
        {
            "q": "Slippage means:",
            "options": [
                "Your broker stole shares",
                "Fill price differs from the price you expected",
                "Dividends were reinvested",
            ],
            "correct": 1,
        },
        {
            "q": "A stop-loss market order primarily:",
            "options": [
                "Locks in a guaranteed exit price",
                "Triggers a market sell once a trigger price trades",
                "Removes all overnight risk",
            ],
            "correct": 1,
        },
        {
            "q": "Paper fills often look better than live because they ignore:",
            "options": [
                "Charts",
                "Spreads, partial fills, and emotional size creep",
                "Company fundamentals",
            ],
            "correct": 1,
        },
        {
            "q": "Regular U.S. equity session risk is concentrated around:",
            "options": [
                "Only weekends",
                "Open, close, and news windows when spreads widen",
                "Lunch only",
            ],
            "correct": 1,
        },
    ],
    "strategy-design": [
        {
            "q": "Expectancy roughly means:",
            "options": [
                "Guaranteed next-trade profit",
                "Average outcome per trade given win rate and payoff",
                "How many indicators you use",
            ],
            "correct": 1,
        },
        {
            "q": "Overfitting a backtest usually happens when you:",
            "options": [
                "Use out-of-sample tests",
                "Tune many parameters until history looks perfect",
                "Compare to buy-and-hold",
            ],
            "correct": 1,
        },
        {
            "q": "Max drawdown tells you:",
            "options": [
                "Only the best winning streak",
                "The worst peak-to-trough equity decline in the sample",
                "Next week's return",
            ],
            "correct": 1,
        },
        {
            "q": "Daily VaR answers:",
            "options": [
                "How much you will definitely lose tomorrow",
                "A statistical loss threshold under a confidence level",
                "Your broker's margin call time",
            ],
            "correct": 1,
        },
        {
            "q": "A strategy should beat a simple baseline like:",
            "options": [
                "Random tweets",
                "Buy-and-hold of the same instrument (fees aside)",
                "Always being 100% cash",
            ],
            "correct": 1,
        },
        {
            "q": "Before risking real capital, prioritize:",
            "options": [
                "Max leverage",
                "Position sizing, journal, and paper/live rule parity",
                "More indicators on one chart",
            ],
            "correct": 1,
        },
    ],
}
