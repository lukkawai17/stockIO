"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMarketStatus, fetchQuotes, fetchScan, triggerRefresh } from "@/lib/api";
import { loadWatchlist, toggleWatch } from "@/lib/watchlist";
import type { ScanResponse, StockRow } from "@/lib/types";
import { StockCard } from "./StockCard";

type Props = {
  mode: "short" | "long";
  title: string;
  subtitle: string;
};

function mergeQuotes(rows: StockRow[], quotes: Record<string, { price: number; change_pct: number }>) {
  return rows.map((r) => {
    const q = quotes[r.ticker];
    return q ? { ...r, price: q.price, change_pct: q.change_pct } : r;
  });
}

export function ScanBoard({ mode, title, subtitle }: Props) {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [quoteAt, setQuoteAt] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const scan = await fetchScan(mode, refresh);
      setData(scan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => {
    setWatch(loadWatchlist());
    load(false);
    fetchMarketStatus()
      .then((s) => setIsOpen(s.is_open))
      .catch(() => undefined);
  }, [load]);

  const tickers = useMemo(() => {
    if (!data) return [] as string[];
    const all = [...(data.bullish || []), ...(data.bearish || []), ...(data.top || [])];
    return Array.from(new Set(all.map((r) => r.ticker)));
  }, [data]);

  useEffect(() => {
    if (!tickers.length) return;

    let cancelled = false;
    const refreshQuotes = async () => {
      try {
        const status = await fetchMarketStatus();
        if (!cancelled) setIsOpen(status.is_open);
        // Refresh quotes every 3 min always (also useful after hours for last price)
        const q = await fetchQuotes(tickers, true);
        if (cancelled || !data) return;
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            top: mergeQuotes(prev.top || [], q.quotes),
            bullish: mergeQuotes(prev.bullish || [], q.quotes),
            bearish: mergeQuotes(prev.bearish || [], q.quotes),
            hold: mergeQuotes(prev.hold || [], q.quotes),
            bottom: mergeQuotes(prev.bottom || [], q.quotes),
          };
        });
        setQuoteAt(q.updated_at_iso || new Date().toISOString());
      } catch {
        /* ignore quote errors */
      }
    };

    refreshQuotes();
    const id = window.setInterval(refreshQuotes, 3 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(",")]);

  const onToggle = (ticker: string) => {
    setWatch(toggleWatch(ticker));
  };

  const onRescore = async () => {
    setRefreshing(true);
    try {
      await triggerRefresh(mode);
      // wait a bit then poll
      await new Promise((r) => setTimeout(r, 2500));
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "重新計分失敗");
      setRefreshing(false);
    }
  };

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="lede">{subtitle}</p>
        </div>
        <div className="head-meta">
          <span className={isOpen ? "pill open" : "pill closed"}>{isOpen ? "開市中" : "已收市"}</span>
          <button type="button" className="btn" onClick={onRescore} disabled={refreshing}>
            {refreshing ? "更新中…" : "重新計分"}
          </button>
        </div>
      </div>

      {data?.updated_at_iso && (
        <p className="meta-line">
          分數更新：{new Date(data.updated_at_iso).toLocaleString()}
          {quoteAt ? ` · 報價：${new Date(quoteAt).toLocaleString()}` : ""}
          {data.scanned ? ` · 已掃描 ${data.scanned} 隻` : ""}
        </p>
      )}

      {loading && <p className="state">載入市場掃描…第一次可能要一兩分鐘。</p>}
      {error && <p className="state error">錯誤：{error}（請確認後端已啟動）</p>}

      {data && !loading && (
        <>
          <div className="board-grid">
            <section>
              <h2>偏多 · 買</h2>
              <div className="list">
                {(data.bullish?.length ? data.bullish : data.top.filter((r) => r.label === "買")).map((r) => (
                  <StockCard key={r.ticker} row={r} watched={watch.includes(r.ticker)} onToggleWatch={onToggle} />
                ))}
                {!data.bullish?.length && !data.top.some((r) => r.label === "買") && <p className="empty">暫無偏多標的</p>}
              </div>
            </section>
            <section>
              <h2>偏淡 · 避開</h2>
              <div className="list">
                {data.bearish.map((r) => (
                  <StockCard key={r.ticker} row={r} watched={watch.includes(r.ticker)} onToggleWatch={onToggle} />
                ))}
                {!data.bearish?.length && <p className="empty">暫無偏淡標的</p>}
              </div>
            </section>
          </div>

          <section className="mt">
            <h2>分數最高</h2>
            <div className="list">
              {data.top.map((r) => (
                <StockCard key={`top-${r.ticker}`} row={r} watched={watch.includes(r.ticker)} onToggleWatch={onToggle} />
              ))}
            </div>
          </section>

          {data.disclaimer && <p className="disclaimer">{data.disclaimer}</p>}
        </>
      )}
    </section>
  );
}
