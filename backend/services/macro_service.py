from fredapi import Fred  # pyright: ignore[reportMissingImports]

from backend.utils.env_keys import fred_key


def get_macro_data():
    key = fred_key() or "YOUR_KEY"
    fred = Fred(api_key=key)
    cpi = fred.get_series("CPIAUCSL").dropna()
    rates = fred.get_series("FEDFUNDS").dropna()
    gdp = fred.get_series("GDP").dropna()
    return {
        "cpi": float(cpi.iloc[-1]),
        "rates": float(rates.iloc[-1]),
        "gdp": float(gdp.iloc[-1]),
    }
