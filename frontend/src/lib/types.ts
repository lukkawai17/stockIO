export type Label = "買" | "持有" | "避開";

export type SupportResistance = {
  support: number;
  resistance: number;
  pivot: number;
  near_support: number;
  near_resistance: number;
  distance_to_support_pct: number;
  distance_to_resistance_pct: number;
};

export type PriceLevels = {
  buy: number | null;
  buy_low: number | null;
  buy_high: number | null;
  sell: number | null;
  stop: number | null;
  risk_reward?: number | null;
  range_position?: number | null;
  entry_mode?: string;
  note: string;
};

export type StockRow = {
  ticker: string;
  name?: string;
  price: number;
  change_pct: number;
  score: number;
  label: Label;
  reason: string;
  signals?: string[];
  horizon?: string;
  hold_period?: string;
  knowledge?: string;
  levels?: PriceLevels;
  buy_price?: number | null;
  sell_price?: number | null;
  stop_price?: number | null;
  rsi?: number;
  macd_hist?: number;
  ret_5d?: number;
  ret_20d?: number;
  volume_ratio?: number;
  ma20?: number;
  ma50?: number;
  ma200?: number | null;
  support_resistance?: SupportResistance;
  is_etf?: boolean;
};

export type ScanResponse = {
  mode: "short" | "long";
  status?: string;
  updated_at?: number;
  updated_at_iso?: string;
  universe_size?: number;
  scanned?: number;
  top: StockRow[];
  bottom?: StockRow[];
  bullish: StockRow[];
  bearish: StockRow[];
  hold?: StockRow[];
  spy?: { price: number; change_pct: number; ret_20d?: number };
  disclaimer?: string;
};

export type Quote = {
  ticker: string;
  price: number;
  change_pct: number;
  updated_at?: number;
};

export type StockDetail = {
  ticker: string;
  price: number;
  change_pct: number;
  snapshot: Record<string, unknown>;
  short: {
    score: number;
    label: Label;
    reason: string;
    signals: string[];
    hold_period: string;
    knowledge: string;
    pillars?: Record<string, number | null | undefined>;
    framework?: string;
    levels?: PriceLevels;
  };
  long: {
    score: number;
    label: Label;
    reason: string;
    signals: string[];
    hold_period: string;
    knowledge: string;
    pillars?: Record<string, number | null | undefined>;
    framework?: string;
    levels?: PriceLevels;
  };
  support_resistance: SupportResistance;
  chart?: {
    price: { time: string; value: number }[];
    ma20: { time: string; value: number }[];
    ma50: { time: string; value: number }[];
    support: number;
    resistance: number;
    range: string;
  } | null;
  earnings: {
    next_earnings: { date: string; eps_estimate: number | null; reported_eps: number | null } | null;
    recent: { date: string; eps_estimate: number | null; reported_eps: number | null }[];
  };
  news: {
    title: string;
    summary?: string;
    publisher?: string;
    link?: string;
    published_at?: string | null;
  }[];
  institutional?: {
    institutions_percent: number | null;
    institutions_float_percent: number | null;
    institutions_count: number | null;
    insiders_percent: number | null;
    report_date: string | null;
    holders: {
      organization: string;
      pct_held: number;
      pct_change: number;
      position: number;
      value: number;
      report_date: string | null;
    }[];
    net_pct_change: number | null;
    increasers: number;
    decreasers: number;
    flow_score: number | null;
    summary: string;
  } | null;
  disclaimer?: string;
};

export type BacktestStats = {
  n: number;
  avg_return_pct: number | null;
  median_return_pct: number | null;
  win_rate_pct: number | null;
  avg_win_pct: number | null;
  avg_loss_pct: number | null;
  worst_trade_pct: number | null;
  best_trade_pct: number | null;
};

export type BacktestHorizon = {
  hold_days: number;
  chase: BacktestStats;
  limit: BacktestStats;
  spy: BacktestStats;
  chase_minus_spy_pct: number | null;
};

export type BacktestModeBlock = {
  mode: string;
  tickers_used: number;
  signals: number;
  limit_fills: number;
  limit_fill_rate_pct: number | null;
  step_days: number;
  limit_wait_days: number;
  horizons: BacktestHorizon[];
};

export type BacktestResponse = {
  status?: string;
  message?: string;
  framework?: string;
  method?: string;
  period?: string;
  universe_cap?: number;
  notes?: string[];
  short: BacktestModeBlock | null;
  long: BacktestModeBlock | null;
  updated_at?: number;
  updated_at_iso?: string;
  disclaimer?: string;
};
