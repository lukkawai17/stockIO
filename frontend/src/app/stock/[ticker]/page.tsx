"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchStock } from "@/lib/api";
import { loadWatchlist, toggleWatch } from "@/lib/watchlist";
import { LabelBadge } from "@/components/LabelBadge";
import { StockChart } from "@/components/StockChart";
import type { StockDetail } from "@/lib/types";

export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params?.ticker || "").toUpperCase();
  const [data, setData] = useState<StockDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    setWatched(loadWatchlist().includes(ticker));
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchStock(ticker);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "載入失敗");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (error) {
    return (
      <section>
        <Link href="/short" className="back-link">
          ‹ 短線
        </Link>
        <div className="state-box error">{error}</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section>
        <Link href="/short" className="back-link">
          ‹ 返回
        </Link>
        <h1 className="large-title">{ticker}</h1>
        <div className="group">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </section>
    );
  }

  const up = data.change_pct > 0;
  const down = data.change_pct < 0;
  const chgClass = up ? "chg up" : down ? "chg down" : "chg flat";
  const sr = data.support_resistance;

  return (
    <section>
      <div className="page-toolbar" style={{ marginBottom: 4 }}>
        <Link href="/short" className="back-link" style={{ margin: 0 }}>
          ‹ 市場
        </Link>
        <button
          type="button"
          className={watched ? "btn btn-ghost" : "btn"}
          onClick={() => setWatched(toggleWatch(data.ticker).includes(data.ticker))}
        >
          {watched ? "已關注" : "加關注"}
        </button>
      </div>

      <div className="detail-hero">
        <h1 className="symbol">{data.ticker}</h1>
        <div className="price-line">
          <span className="price">${data.price.toFixed(2)}</span>
          <span className={chgClass}>
            {up ? "+" : ""}
            {data.change_pct.toFixed(2)}%
          </span>
        </div>
      </div>

      {data.chart && data.chart.price.length > 0 && (
        <>
          <p className="group-header">走勢圖</p>
          <StockChart data={data.chart} up={up || (!up && !down)} />
        </>
      )}

      <p className="group-header">短線建議</p>
      <div className="inset-list">
        <div className="inset-row">
          <dt>標籤</dt>
          <dd>
            <LabelBadge label={data.short.label} />
          </dd>
        </div>
        <div className="inset-row">
          <dt>分數</dt>
          <dd>{data.short.score.toFixed(0)}</dd>
        </div>
        <div className="inset-row">
          <dt>原因</dt>
          <dd style={{ maxWidth: "60%" }}>{data.short.reason}</dd>
        </div>
        <div className="inset-row">
          <dt>觀察期</dt>
          <dd>{data.short.hold_period}</dd>
        </div>
        <p className="group-footer" style={{ margin: "8px 16px 12px" }}>
          {data.short.knowledge}
        </p>
        <div className="signal-wrap">
          {data.short.signals.map((s) => (
            <span key={s} className="signal-chip">
              {s}
            </span>
          ))}
        </div>
      </div>

      <p className="group-header">長線建議</p>
      <div className="inset-list">
        <div className="inset-row">
          <dt>標籤</dt>
          <dd>
            <LabelBadge label={data.long.label} />
          </dd>
        </div>
        <div className="inset-row">
          <dt>分數</dt>
          <dd>{data.long.score.toFixed(0)}</dd>
        </div>
        <div className="inset-row">
          <dt>原因</dt>
          <dd style={{ maxWidth: "60%" }}>{data.long.reason}</dd>
        </div>
        <div className="inset-row">
          <dt>觀察期</dt>
          <dd>{data.long.hold_period}</dd>
        </div>
        <p className="group-footer" style={{ margin: "8px 16px 12px" }}>
          {data.long.knowledge}
        </p>
        <div className="signal-wrap">
          {data.long.signals.map((s) => (
            <span key={s} className="signal-chip">
              {s}
            </span>
          ))}
        </div>
      </div>

      <p className="group-header">支撐 / 阻力</p>
      <div className="inset-list">
        <div className="inset-row">
          <dt>支撐</dt>
          <dd>${sr.support.toFixed(2)}</dd>
        </div>
        <div className="inset-row">
          <dt>阻力</dt>
          <dd>${sr.resistance.toFixed(2)}</dd>
        </div>
        <div className="inset-row">
          <dt>樞軸</dt>
          <dd>${sr.pivot.toFixed(2)}</dd>
        </div>
        <div className="inset-row">
          <dt>距支撐</dt>
          <dd>{sr.distance_to_support_pct.toFixed(2)}%</dd>
        </div>
        <div className="inset-row">
          <dt>距阻力</dt>
          <dd>{sr.distance_to_resistance_pct.toFixed(2)}%</dd>
        </div>
      </div>
      <p className="group-footer">接近支撐或有反彈空間；接近阻力要小心冲關失敗。</p>

      <p className="group-header">財報</p>
      <div className="inset-list">
        {data.earnings.next_earnings ? (
          <>
            <div className="inset-row">
              <dt>下次財報</dt>
              <dd>{new Date(data.earnings.next_earnings.date).toLocaleString()}</dd>
            </div>
            <div className="inset-row">
              <dt>EPS 預期</dt>
              <dd>{data.earnings.next_earnings.eps_estimate ?? "—"}</dd>
            </div>
          </>
        ) : (
          <div className="state-box">暫無下次財報（ETF 通常冇）</div>
        )}
        {data.earnings.recent?.map((e) => (
          <div key={e.date} className="inset-row">
            <dt>{new Date(e.date).toLocaleDateString()}</dt>
            <dd>
              預期 {e.eps_estimate ?? "—"} / 實際 {e.reported_eps ?? "—"}
            </dd>
          </div>
        ))}
      </div>

      <p className="group-header">新聞</p>
      <div className="inset-list">
        {!data.news?.length && <div className="state-box">暫時冇新聞</div>}
        {data.news?.map((n) => (
          <a
            key={`${n.title}-${n.published_at}`}
            className="news-row"
            href={n.link || undefined}
            target={n.link ? "_blank" : undefined}
            rel="noreferrer"
          >
            <strong>{n.title}</strong>
            <p className="meta">
              {n.publisher || "來源未知"}
              {n.published_at ? ` · ${new Date(n.published_at).toLocaleString()}` : ""}
            </p>
          </a>
        ))}
      </div>

      {data.disclaimer && <p className="group-footer">{data.disclaimer}</p>}
    </section>
  );
}
