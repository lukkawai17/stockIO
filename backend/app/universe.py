"""US market universe: S&P 500 core + Nasdaq-100 + major ETFs."""

MAJOR_ETFS = [
    "SPY",
    "QQQ",
    "IWM",
    "DIA",
    "VTI",
    "VOO",
    "XLK",
    "XLF",
    "XLE",
    "XLV",
    "XLI",
    "XLY",
    "XLP",
    "XLU",
    "XLB",
    "XLRE",
    "XLC",
    "SMH",
    "ARKK",
    "TQQQ",
]

# Nasdaq-100 (common liquid names; some overlap with S&P)
NASDAQ_100 = [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "TSLA", "AVGO", "COST",
    "NFLX", "AMD", "PEP", "ADBE", "CSCO", "TMUS", "LIN", "INTU", "QCOM", "AMAT",
    "TXN", "ISRG", "CMCSA", "AMGN", "HON", "INTC", "BKNG", "SBUX", "GILD", "ADP",
    "VRTX", "ADI", "PANW", "MU", "REGN", "LRCX", "MDLZ", "PYPL", "KLAC", "SNPS",
    "CDNS", "CRWD", "MELI", "ASML", "MAR", "CTAS", "ORLY", "CSX", "FTNT", "NXPI",
    "DASH", "ADSK", "ABNB", "MRVL", "PCAR", "WDAY", "AEP", "CPRT", "ROST", "PAYX",
    "ODFL", "FAST", "BKR", "KDP", "EA", "VRSK", "EXC", "GEHC", "CTSH", "XEL",
    "CCEP", "FANG", "KHC", "IDXX", "CSGP", "TTWO", "ON", "BIIB", "DDOG", "CDW",
    "ZS", "TEAM", "DXCM", "MCHP", "TTD", "GFS", "ARM", "PLTR", "APP", "SHOP",
]

# Broad S&P liquid names beyond Nasdaq-100
SP500_EXTRA = [
    "BRK-B", "JPM", "V", "UNH", "XOM", "JNJ", "WMT", "MA", "PG", "HD",
    "CVX", "MRK", "ABBV", "KO", "CRM", "BAC", "PFE", "TMO", "ACN", "DIS",
    "ABT", "WFC", "DHR", "IBM", "CAT", "GE", "MCD", "AXP", "GS", "MS",
    "PM", "UPS", "RTX", "NEE", "LOW", "UNP", "SPGI", "BA", "BLK", "ELV",
    "PGR", "TJX", "SYK", "MDT", "DE", "COP", "BMY", "CB", "MET", "SO",
    "DUK", "CI", "SCHW", "MO", "BSX", "EQIX", "CME", "PLD", "ICE", "CL",
    "ZTS", "APD", "ITW", "WM", "NOC", "GD", "EMR", "NSC", "PH", "HCA",
    "T", "USB", "PNC", "AON", "MCO", "FCX", "SLB", "EOG", "PSX", "MPC",
    "CVS", "HUM", "CNC", "TGT", "NKE", "GM", "F", "DAL", "UAL", "LMT",
]

def all_tickers() -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for t in MAJOR_ETFS + NASDAQ_100 + SP500_EXTRA:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def etf_tickers() -> list[str]:
    return list(MAJOR_ETFS)


def equity_tickers() -> list[str]:
    etfs = set(MAJOR_ETFS)
    return [t for t in all_tickers() if t not in etfs]
