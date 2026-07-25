/** SEC 13F-style ownership from Yahoo (quarterly lag). */

export type InstHolder = {
  organization: string;
  pct_held: number;
  pct_change: number;
  position: number;
  value: number;
  report_date: string | null;
};

export type Institutional = {
  institutions_percent: number | null;
  institutions_float_percent: number | null;
  institutions_count: number | null;
  insiders_percent: number | null;
  report_date: string | null;
  holders: InstHolder[];
  /** Net weighted % change across top holders (positive = accumulation). */
  net_pct_change: number | null;
  increasers: number;
  decreasers: number;
  /** 0–100 smart-money proxy score for long scoring. */
  flow_score: number | null;
  summary: string;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function iso(v: unknown): string | null {
  if (!v) return null;
  try {
    return new Date(v as string | number | Date).toISOString();
  } catch {
    return null;
  }
}

export function parseInstitutional(summary: {
  majorHoldersBreakdown?: {
    insidersPercentHeld?: number;
    institutionsPercentHeld?: number;
    institutionsFloatPercentHeld?: number;
    institutionsCount?: number;
  } | null;
  institutionOwnership?: {
    ownershipList?: Array<{
      organization?: string;
      pctHeld?: number;
      pctChange?: number;
      position?: number;
      value?: number;
      reportDate?: string | Date;
    }>;
  } | null;
} | null): Institutional | null {
  if (!summary) return null;
  const major = summary.majorHoldersBreakdown;
  const list = summary.institutionOwnership?.ownershipList || [];
  if (!major && !list.length) return null;

  const holders: InstHolder[] = list.slice(0, 10).map((h) => ({
    organization: h.organization || "—",
    pct_held: num(h.pctHeld) ?? 0,
    pct_change: num(h.pctChange) ?? 0,
    position: num(h.position) ?? 0,
    value: num(h.value) ?? 0,
    report_date: iso(h.reportDate),
  }));

  let weightSum = 0;
  let weightedChange = 0;
  let increasers = 0;
  let decreasers = 0;
  for (const h of holders) {
    const w = Math.max(h.pct_held, 0.0001);
    weightSum += w;
    weightedChange += h.pct_change * w;
    if (h.pct_change > 0.002) increasers++;
    else if (h.pct_change < -0.002) decreasers++;
  }
  const net = weightSum > 0 ? weightedChange / weightSum : null;

  let flow = 50;
  const instPct = num(major?.institutionsPercentHeld);
  if (instPct != null) {
    if (instPct >= 0.55) flow += 8;
    else if (instPct >= 0.35) flow += 4;
    else if (instPct < 0.15) flow -= 8;
  }
  if (net != null) {
    // net is fractional change (0.05 = +5% shares among weighted holders)
    if (net > 0.08) {
      flow += 22;
    } else if (net > 0.02) {
      flow += 12;
    } else if (net > 0) {
      flow += 4;
    } else if (net < -0.08) {
      flow -= 22;
    } else if (net < -0.02) {
      flow -= 12;
    } else if (net < 0) {
      flow -= 4;
    }
  }
  if (increasers - decreasers >= 3) flow += 8;
  else if (decreasers - increasers >= 3) flow -= 8;
  flow = Math.max(0, Math.min(100, flow));

  const netPct = net == null ? null : Math.round(net * 10000) / 100; // to %
  let summaryTxt = "暫無足夠機構持股變化數據。";
  if (net != null) {
    if (net > 0.02) summaryTxt = `頂級機構整體偏增持（加權約 ${netPct! > 0 ? "+" : ""}${netPct}%）。`;
    else if (net < -0.02) summaryTxt = `頂級機構整體偏減持（加權約 ${netPct}%）。`;
    else summaryTxt = "頂級機構持股變化接近持平。";
  }
  if (instPct != null) {
    summaryTxt += ` 機構持股約 ${(instPct * 100).toFixed(0)}%。`;
  }
  summaryTxt += " 數據來自 13F／季報，通常滯後數週至數月。";

  return {
    institutions_percent: instPct,
    institutions_float_percent: num(major?.institutionsFloatPercentHeld),
    institutions_count: num(major?.institutionsCount),
    insiders_percent: num(major?.insidersPercentHeld),
    report_date: holders[0]?.report_date ?? null,
    holders,
    net_pct_change: netPct,
    increasers,
    decreasers,
    flow_score: Math.round(flow * 10) / 10,
    summary: summaryTxt,
  };
}
