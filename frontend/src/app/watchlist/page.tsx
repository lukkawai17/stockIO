"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchQuotes, fetchStock } from "@/lib/api";
import { exportWatchlist, importWatchlist, loadWatchlist, saveWatchlist, toggleWatch } from "@/lib/watchlist";
import { LabelBadge } from "@/components/LabelBadge";
import type { Label } from "@/lib/types";

type Row = {
  ticker: string;
  price: number;
  change_pct: number;
  label?: Label;
  score?: number;
  reason?: string;
};

export default function WatchlistPage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [importText, setImportText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTickers(loadWatchlist());
  }, []);

  useEffect(() => {
    if (!tickers.length) {
      setRows([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const quotes = await fetchQuotes(tickers, true);
        const details = await Promise.all(
          tickers.map(async (t) => {
            try {
              const d = await fetchStock(t);
              return {
                ticker: t,
                price: quotes.quotes[t]?.price ?? d.price,
                change_pct: quotes.quotes[t]?.change_pct ?? d.change_pct,
                label: d.short.label,
                score: d.short.score,
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
        if (!cancelled) setRows(details);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "載入失敗");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const id = window.setInterval(run, 3 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tickers.join(",")]);

  const exportJson = useMemo(() => exportWatchlist(), [tickers.join(",")]);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>我的關注</h1>
          <p className="lede">清單只存在呢部手機／瀏覽器。換機可以匯出再匯入。唔使登入。</p>
        </div>
      </div>

      <div className="watch-toolbar">
        <button
          type="button"
          className="btn"
          onClick={() => {
            navigator.clipboard?.writeText(exportJson);
          }}
        >
          複製匯出 JSON
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            try {
              setTickers(importWatchlist(importText));
              setImportText("");
            } catch {
              setError("匯入格式唔啱");
            }
          }}
        >
          匯入
        </button>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='貼上 {"watchlist":["AAPL","NVDA"]} 或 ["AAPL"]'
        />
      </div>

      {loading && <p className="state">更新報價中…</p>}
      {error && <p className="state error">{error}</p>}
      {!tickers.length && (
        <p className="state">
          尚未有關注。去 <Link href="/short">短線</Link> / <Link href="/long">長線</Link> 加入。
        </p>
      )}

      <div className="list">
        {rows.map((r) => {
          const up = r.change_pct >= 0;
          return (
            <article key={r.ticker} className="stock-row">
              <div className="stock-main">
                <Link href={`/stock/${r.ticker}`} className="ticker">
                  {r.ticker}
                </Link>
                {r.label && <LabelBadge label={r.label} />}
                {r.score != null && <span className="score">分 {r.score.toFixed(0)}</span>}
              </div>
              <div className="stock-price">
                <span>${r.price.toFixed(2)}</span>
                <span className={up ? "up" : "down"}>
                  {up ? "+" : ""}
                  {r.change_pct.toFixed(2)}%
                </span>
              </div>
              {r.reason && <p className="reason">{r.reason}</p>}
              <div className="row-actions">
                <Link href={`/stock/${r.ticker}`} className="text-btn">
                  詳情
                </Link>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setTickers(toggleWatch(r.ticker))}
                >
                  移除
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!!tickers.length && (
        <p className="meta-line mt">
          目前 {tickers.length} 隻 ·{" "}
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              if (confirm("清空全部關注？")) setTickers(saveWatchlist([]));
            }}
          >
            清空清單
          </button>
        </p>
      )}
    </section>
  );
}
