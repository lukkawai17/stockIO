"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchMarketStatus, fetchQuotes, fetchScan, triggerRefresh } from "@/lib/api";
import { loadWatchlist, toggleWatch } from "@/lib/watchlist";
import type { ScanResponse, StockRow } from "@/lib/types";
import { StockCard } from "./StockCard";

type Props = {
  mode: "short" | "long";
  title: string;
  subtitle: string;
};

type Tab = "buy" | "avoid" | "top";

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
  const [tab, setTab] = useState<Tab>("buy");

  const load = useCallback(
    async (refresh = false) => {
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
    },
    [mode]
  );

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
        const q = await fetchQuotes(tickers, true);
        if (cancelled) return;
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
        /* ignore */
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

  const rows = useMemo(() => {
    if (!data) return [] as StockRow[];
    if (tab === "buy") {
      return data.bullish?.length ? data.bullish : data.top.filter((r) => r.label === "買");
    }
    if (tab === "avoid") return data.bearish || [];
    return data.top || [];
  }, [data, tab]);

  const onToggle = (ticker: string) => setWatch(toggleWatch(ticker));

  const onRescore = async () => {
    setRefreshing(true);
    try {
      const res = await triggerRefresh(mode);
      await load(false);
      alert(res.message || "分數由系統定時更新；報價會繼續自動刷新。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失敗");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section>
      <h1 className="large-title">{title}</h1>
      <p className="page-sub">{subtitle}</p>

      <div className="page-toolbar">
        <span className={isOpen ? "status-dot open" : "status-dot"}>{isOpen ? "開市中" : "已收市"}</span>
        <button type="button" className="btn btn-ghost" onClick={onRescore} disabled={refreshing}>
          {refreshing ? "更新中" : "關於更新"}
        </button>
      </div>

      {(data?.updated_at_iso || quoteAt) && (
        <p className="meta-caption">
          {data?.updated_at_iso ? `分數 ${new Date(data.updated_at_iso).toLocaleString()}` : ""}
          {quoteAt ? ` · 報價 ${new Date(quoteAt).toLocaleTimeString()}` : ""}
          {data?.scanned ? ` · ${data.scanned} 隻` : ""}
        </p>
      )}

      <div className="segmented" role="tablist" aria-label="名單類型">
        <button type="button" className={tab === "buy" ? "active" : ""} onClick={() => setTab("buy")}>
          偏多
        </button>
        <button type="button" className={tab === "avoid" ? "active" : ""} onClick={() => setTab("avoid")}>
          偏淡
        </button>
        <button type="button" className={tab === "top" ? "active" : ""} onClick={() => setTab("top")}>
          最高分
        </button>
      </div>

      {loading && (
        <div className="group">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}

      {error && <div className="state-box error">{error}</div>}

      {!loading && data && (
        <>
          <p className="group-header">
            {tab === "buy" ? "建議關注 · 買" : tab === "avoid" ? "暫避 · 避開" : "分數排名"}
          </p>
          <div className="group">
            {rows.length ? (
              rows.map((r, i) => (
                <StockCard
                  key={`${tab}-${r.ticker}`}
                  row={r}
                  watched={watch.includes(r.ticker)}
                  onToggleWatch={onToggle}
                  style={{ animationDelay: `${i * 0.03}s` } as CSSProperties}
                />
              ))
            ) : (
              <div className="state-box">暫時冇呢類標的</div>
            )}
          </div>
          {data.disclaimer && <p className="group-footer">{data.disclaimer}</p>}
        </>
      )}
    </section>
  );
}
