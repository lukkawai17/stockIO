"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fetchMarketStatus, fetchQuotes, fetchScan, triggerRefresh } from "@/lib/api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
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

function scoreStatusLabel(status?: string) {
  if (status === "live") return "（即時）";
  if (status === "live_cached") return "（即時快取）";
  if (status === "live_partial") return "（即時·部分）";
  if (status === "live_failed") return "（即時失敗·沿用掃描）";
  if (status === "universe_stale") return "（掃描偏舊）";
  return "";
}

export function ScanBoard({ mode, title, subtitle }: Props) {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoreWarning, setScoreWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [watch, setWatch] = useState<string[]>(() => loadWatchlist());
  const [isOpen, setIsOpen] = useState(false);
  const [sessionLabel, setSessionLabel] = useState("—");
  const [quoteAt, setQuoteAt] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("buy");
  const [pollHint, setPollHint] = useState("約 45 秒");
  const [scoreHint, setScoreHint] = useState("約 3 分鐘");

  const applyScan = useCallback((scan: ScanResponse) => {
    setData(scan);
    if (scan.status === "live_failed" || scan.message) {
      setScoreWarning(scan.message || null);
    } else if (scan.status === "live" || scan.status === "live_cached" || scan.status === "live_partial") {
      setScoreWarning(scan.message || null);
    }
  }, []);

  const loadStatic = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const scan = await fetchScan(mode);
      applyScan(scan);
      if (scan.universe_stale || scan.status === "universe_stale") {
        setScoreWarning(scan.message || "全市場掃描偏舊；正在嘗試即時重計榜內標的。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [mode, applyScan]);

  const refreshScores = useCallback(async () => {
    setScoring(true);
    try {
      const scan = await fetchScan(mode, { live: true });
      applyScan(scan);
      if (scan.status === "live_failed") {
        setScoreWarning(scan.message || "即時重計失敗，沿用掃描分數");
      }
    } catch (e) {
      setScoreWarning(e instanceof Error ? e.message : "即時重計失敗，沿用現有分數");
    } finally {
      setScoring(false);
    }
  }, [mode, applyScan]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      loadStatic();
    }, 0);
    fetchMarketStatus()
      .then((s) => {
        setIsOpen(s.is_open);
        setSessionLabel(s.session_label || (s.is_open ? "開市中" : "已收市"));
        if (s.poll_interval_ms) {
          const sec = Math.round(s.poll_interval_ms / 1000);
          setPollHint(sec < 60 ? `約 ${sec} 秒` : `約 ${Math.round(sec / 60)} 分鐘`);
        }
        const session = s.session || (s.is_open ? "regular" : "closed");
        if (session === "regular") setScoreHint("約 3 分鐘");
        else if (session === "pre" || session === "post") setScoreHint("約 5 分鐘");
        else setScoreHint("約 15 分鐘");
      })
      .catch(() => undefined);
    return () => window.clearTimeout(t);
  }, [loadStatic]);

  const tickers = useMemo(() => {
    if (!data) return [] as string[];
    const all = [...(data.bullish || []), ...(data.bearish || []), ...(data.top || [])];
    return Array.from(new Set(all.map((r) => r.ticker)));
  }, [data]);

  const refreshQuotes = useCallback(async () => {
    if (!tickers.length) return;
    try {
      const q = await fetchQuotes(tickers, true);
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
      /* ignore transient quote failures */
    }
  }, [tickers]);

  useAutoRefresh(refreshQuotes, {
    enabled: tickers.length > 0,
    watchKey: tickers.join(","),
    onStatus: (s) => {
      setIsOpen(s.is_open);
      setSessionLabel(
        s.session_label ||
          (s.is_open ? "開市中" : s.session === "pre" ? "盤前" : s.session === "post" ? "盤後" : "已收市")
      );
      if (s.poll_interval_ms) {
        const sec = Math.round(s.poll_interval_ms / 1000);
        setPollHint(sec < 60 ? `約 ${sec} 秒` : `約 ${Math.round(sec / 60)} 分鐘`);
      }
      if (s.session === "regular") setScoreHint("約 3 分鐘");
      else if (s.session === "pre" || s.session === "post") setScoreHint("約 5 分鐘");
      else setScoreHint("約 15 分鐘");
    },
  });

  useAutoRefresh(refreshScores, {
    enabled: !loading,
    watchKey: mode,
    openIntervalMs: 3 * 60_000,
    closedIntervalMs: 15 * 60_000,
    useStatusInterval: false,
  });

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
      if (res.top || res.bullish) {
        applyScan({
          mode,
          status: res.status,
          updated_at_iso: res.updated_at_iso,
          scanned: res.scanned,
          top: res.top || [],
          bullish: res.bullish || [],
          bearish: res.bearish || [],
          hold: res.hold || [],
          bottom: res.bottom || [],
          disclaimer: res.disclaimer,
          message: res.message,
          universe_updated_at_iso: data?.universe_updated_at_iso,
          universe_stale: data?.universe_stale,
        });
      } else {
        await refreshScores();
      }
      await refreshQuotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失敗");
    } finally {
      setRefreshing(false);
    }
  };

  const statusClass =
    isOpen || sessionLabel === "盤前" || sessionLabel === "盤後" ? "status-dot open" : "status-dot";

  const universeIso = data?.universe_updated_at_iso || (!data?.live ? data?.updated_at_iso : undefined);
  const scoreIso = data?.live || data?.status?.startsWith("live") ? data?.updated_at_iso : null;

  return (
    <section>
      <h1 className="large-title">{title}</h1>
      <p className="page-sub">{subtitle}</p>

      <div className="page-toolbar">
        <span className={statusClass}>{sessionLabel}</span>
        <button type="button" className="btn btn-ghost" onClick={() => refreshQuotes()} disabled={!tickers.length}>
          刷新報價
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRescore} disabled={refreshing || scoring}>
          {refreshing || scoring ? "計分中" : "重計分數"}
        </button>
      </div>

      {(data?.updated_at_iso || quoteAt) && (
        <p className="meta-caption">
          {scoreIso
            ? `分數 ${new Date(scoreIso).toLocaleString()}${scoreStatusLabel(data?.status)}`
            : data?.updated_at_iso
              ? `分數 ${new Date(data.updated_at_iso).toLocaleString()}${scoreStatusLabel(data?.status)}`
              : ""}
          {scoring ? " · 重計中…" : ""}
          {quoteAt ? ` · 報價 ${new Date(quoteAt).toLocaleTimeString()}` : ""}
          {data?.scanned ? ` · ${data.scanned} 隻` : ""}
        </p>
      )}
      {universeIso && (
        <p className="meta-caption">
          全市場掃描 {new Date(universeIso).toLocaleString()}
          {data?.universe_stale ? " · 偏舊" : ""}
        </p>
      )}
      {scoreWarning && (
        <p className="signal-disclaimer" role="status">
          {scoreWarning}
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
          <p className="group-footer">
            報價開市約每 45 秒更新（而家 {pollHint}）。榜內分數即時重計（而家 {scoreHint}
            ）。全市場掃描由 GitHub Actions 定時寫入；超過約 36 小時會標「偏舊」。
          </p>
        </>
      )}
    </section>
  );
}
