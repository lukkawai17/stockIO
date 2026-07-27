"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fetchQuotes, fetchStock } from "@/lib/api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { exportWatchlist, importWatchlist, loadWatchlist, saveWatchlist, toggleWatch } from "@/lib/watchlist";
import { LabelBadge } from "@/components/LabelBadge";
import { PriceChange } from "@/components/PriceChange";
import type { Label } from "@/lib/types";

type Row = {
  ticker: string;
  price: number;
  change_pct: number;
  shortLabel?: Label;
  shortScore?: number;
  longLabel?: Label;
  longScore?: number;
  reason?: string;
};

export default function WatchlistPage() {
  const [tickers, setTickers] = useState<string[]>(() => loadWatchlist());
  const [rows, setRows] = useState<Row[]>([]);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteAt, setQuoteAt] = useState<string | null>(null);
  const rowsReady = useRef(false);
  const tickersKey = tickers.join(",");

  const loadFull = useCallback(async () => {
    if (!tickers.length) {
      setRows([]);
      rowsReady.current = false;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const quotes = await fetchQuotes(tickers, true);
      setQuoteAt(quotes.updated_at_iso || new Date().toISOString());
      const details = await Promise.all(
        tickers.map(async (t) => {
          try {
            const d = await fetchStock(t);
            return {
              ticker: t,
              price: quotes.quotes[t]?.price ?? d.quote?.price ?? d.price,
              change_pct: quotes.quotes[t]?.change_pct ?? d.quote?.change_pct ?? d.change_pct,
              shortLabel: d.short.label,
              shortScore: d.short.score,
              longLabel: d.long.label,
              longScore: d.long.score,
              reason: d.short.reason,
            } as Row;
          } catch {
            const q = quotes.quotes[t];
            return {
              ticker: t,
              price: q?.price ?? 0,
              change_pct: q?.change_pct ?? 0,
            } as Row;
          }
        })
      );
      setRows(details);
      rowsReady.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [tickers]);

  const refreshQuotesOnly = useCallback(async () => {
    if (!tickers.length) return;
    if (!rowsReady.current) {
      await loadFull();
      return;
    }
    try {
      const quotes = await fetchQuotes(tickers, true);
      setQuoteAt(quotes.updated_at_iso || new Date().toISOString());
      setRows((prev) =>
        prev
          .filter((r) => tickers.includes(r.ticker))
          .map((r) => {
            const q = quotes.quotes[r.ticker];
            return q ? { ...r, price: q.price, change_pct: q.change_pct } : r;
          })
      );
    } catch {
      /* keep last rows */
    }
  }, [tickers, loadFull]);

  useAutoRefresh(refreshQuotesOnly, { enabled: tickers.length > 0, watchKey: tickersKey });

  const exportJson = useMemo(() => {
    void tickers;
    return exportWatchlist();
  }, [tickers]);

  return (
    <section>
      <h1 className="large-title">關注</h1>
      <p className="page-sub">清單保存在呢部裝置。顯示短線＋長線建議。開市時報價會自動刷新。</p>

      <div className="toolbar-row">
        <button type="button" className="btn btn-ghost" onClick={() => loadFull()}>
          刷新
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigator.clipboard?.writeText(exportJson)}
        >
          複製匯出
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setShowImport((v) => !v)}>
          {showImport ? "收起匯入" : "匯入"}
        </button>
        {!!tickers.length && (
          <button
            type="button"
            className="btn-plain"
            onClick={() => {
              if (confirm("清空全部關注？")) setTickers(saveWatchlist([]));
            }}
          >
            清空
          </button>
        )}
      </div>

      {quoteAt && <p className="meta-caption">報價 {new Date(quoteAt).toLocaleTimeString()}</p>}

      {showImport && (
        <>
          <textarea
            className="textarea"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"watchlist":["AAPL","NVDA"]}'
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              try {
                setTickers(importWatchlist(importText));
                setImportText("");
                setShowImport(false);
              } catch {
                setError("匯入格式唔啱");
              }
            }}
          >
            確認匯入
          </button>
        </>
      )}

      {loading && <p className="meta-caption">更新報價中…</p>}
      {error && <div className="state-box error">{error}</div>}

      {!tickers.length && !loading && (
        <div className="group">
          <div className="state-box">
            尚未有關注。去 <Link href="/short">短線</Link> 或 <Link href="/long">長線</Link> 加 ★
          </div>
        </div>
      )}

      {!!rows.length && (
        <>
          <p className="group-header">{tickers.length} 隻股票</p>
          <div className="group">
            {rows.map((r) => (
              <div key={r.ticker} className="stock-cell">
                <Link href={`/stock/${r.ticker}`} className="stock-cell-left">
                  <span className="stock-symbol">{r.ticker}</span>
                  <div className="row-meta">
                    {r.shortLabel && (
                      <>
                        <span className="meta-caption">短</span>
                        <LabelBadge label={r.shortLabel} />
                        {r.shortScore != null && (
                          <span className="score-chip">{r.shortScore.toFixed(0)}</span>
                        )}
                      </>
                    )}
                    {r.longLabel && (
                      <>
                        <span className="meta-caption">長</span>
                        <LabelBadge label={r.longLabel} />
                        {r.longScore != null && (
                          <span className="score-chip">{r.longScore.toFixed(0)}</span>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      className="star-btn on"
                      aria-label="移除關注"
                      onClick={(e) => {
                        e.preventDefault();
                        setTickers(toggleWatch(r.ticker));
                      }}
                    >
                      ★
                    </button>
                  </div>
                  {r.reason && <p className="stock-reason">{r.reason}</p>}
                </Link>
                <Link href={`/stock/${r.ticker}`} className="stock-cell-right">
                  <span className="stock-price">${r.price.toFixed(2)}</span>
                  <PriceChange pct={r.change_pct} />
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
