/** Build chart series from OHLCV bars for the detail page. */

export type ChartPoint = {
  time: string; // YYYY-MM-DD
  value: number;
};

export type ChartPayload = {
  price: ChartPoint[];
  ma20: ChartPoint[];
  ma50: ChartPoint[];
  support: number;
  resistance: number;
  range: string;
};

type BarIn = {
  date?: Date | string | number | null;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function toDay(d: Date | string | number): string | null {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function rollingMa(closes: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i + 1 - window; j <= i; j++) sum += closes[j];
    out.push(Math.round((sum / window) * 100) / 100);
  }
  return out;
}

export function buildChartPayload(
  bars: BarIn[],
  support: number,
  resistance: number,
  keepDays = 140
): ChartPayload | null {
  if (bars.length < 30) return null;

  const dated = bars
    .map((b) => {
      const time = b.date != null ? toDay(b.date) : null;
      return time ? { time, close: b.close } : null;
    })
    .filter((x): x is { time: string; close: number } => !!x);

  // If dates missing, synthesize from end
  let series = dated;
  if (!series.length) {
    const today = new Date();
    series = bars.map((b, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (bars.length - 1 - i));
      return { time: d.toISOString().slice(0, 10), close: b.close };
    });
  }

  const sliced = series.slice(-keepDays);
  const closes = sliced.map((s) => s.close);
  const ma20 = rollingMa(closes, 20);
  const ma50 = rollingMa(closes, 50);

  const price: ChartPoint[] = sliced.map((s) => ({
    time: s.time,
    value: Math.round(s.close * 100) / 100,
  }));

  const ma20Pts: ChartPoint[] = [];
  const ma50Pts: ChartPoint[] = [];
  for (let i = 0; i < sliced.length; i++) {
    if (ma20[i] != null) ma20Pts.push({ time: sliced[i].time, value: ma20[i] as number });
    if (ma50[i] != null) ma50Pts.push({ time: sliced[i].time, value: ma50[i] as number });
  }

  return {
    price,
    ma20: ma20Pts,
    ma50: ma50Pts,
    support: Math.round(support * 100) / 100,
    resistance: Math.round(resistance * 100) / 100,
    range: "6M",
  };
}
