"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchStock } from "@/lib/api";
import { loadWatchlist, toggleWatch } from "@/lib/watchlist";
import { LabelBadge } from "@/components/LabelBadge";
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
      <section className="page">
        <p className="state error">{error}</p>
        <Link href="/short" className="text-btn">
          返回短線
        </Link>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="page">
        <p className="state">載入 {ticker}…</p>
      </section>
    );
  }

  const up = data.change_pct >= 0;
  const sr = data.support_resistance;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{data.ticker}</h1>
          <p className="lede">
            ${data.price.toFixed(2)}{" "}
            <span className={up ? "up" : "down"}>
              {up ? "+" : ""}
              {data.change_pct.toFixed(2)}%
            </span>
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => setWatched(toggleWatch(data.ticker).includes(data.ticker))}
        >
          {watched ? "移除關注" : "加入關注"}
        </button>
      </div>

      <div className="detail-grid">
        <div className="panel">
          <h2>短線建議</h2>
          <div className="stock-main">
            <LabelBadge label={data.short.label} />
            <span className="score">分 {data.short.score.toFixed(0)}</span>
          </div>
          <p className="reason">{data.short.reason}</p>
          <p className="meta">建議觀察：{data.short.hold_period}</p>
          <p className="reason">{data.short.knowledge}</p>
          <ul className="signals">
            {data.short.signals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>長線建議</h2>
          <div className="stock-main">
            <LabelBadge label={data.long.label} />
            <span className="score">分 {data.long.score.toFixed(0)}</span>
          </div>
          <p className="reason">{data.long.reason}</p>
          <p className="meta">建議觀察：{data.long.hold_period}</p>
          <p className="reason">{data.long.knowledge}</p>
          <ul className="signals">
            {data.long.signals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>支撐 / 阻力</h2>
          <dl className="kv">
            <div>
              <dt>支撐</dt>
              <dd>${sr.support.toFixed(2)}</dd>
            </div>
            <div>
              <dt>阻力</dt>
              <dd>${sr.resistance.toFixed(2)}</dd>
            </div>
            <div>
              <dt>樞軸</dt>
              <dd>${sr.pivot.toFixed(2)}</dd>
            </div>
            <div>
              <dt>距支撐</dt>
              <dd>{sr.distance_to_support_pct.toFixed(2)}%</dd>
            </div>
            <div>
              <dt>距阻力</dt>
              <dd>{sr.distance_to_resistance_pct.toFixed(2)}%</dd>
            </div>
          </dl>
          <p className="meta mt">接近支撐可能有反彈空間；接近阻力要小心冲關失敗。</p>
        </div>

        <div className="panel">
          <h2>財報日期</h2>
          {data.earnings.next_earnings ? (
            <dl className="kv">
              <div>
                <dt>下次財報</dt>
                <dd>{new Date(data.earnings.next_earnings.date).toLocaleString()}</dd>
              </div>
              <div>
                <dt>EPS 預期</dt>
                <dd>{data.earnings.next_earnings.eps_estimate ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="empty">暫無下次財報資料（ETF 通常冇）。</p>
          )}
          {!!data.earnings.recent?.length && (
            <>
              <h2 className="mt">近期財報</h2>
              <dl className="kv">
                {data.earnings.recent.map((e) => (
                  <div key={e.date}>
                    <dt>{new Date(e.date).toLocaleDateString()}</dt>
                    <dd>
                      預期 {e.eps_estimate ?? "—"} / 實際 {e.reported_eps ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </div>

      <section className="panel mt">
        <h2>相關新聞</h2>
        {!data.news?.length && <p className="empty">暫時冇新聞。</p>}
        {data.news?.map((n) => (
          <article key={`${n.title}-${n.published_at}`} className="news-item">
            {n.link ? (
              <a href={n.link} target="_blank" rel="noreferrer">
                {n.title}
              </a>
            ) : (
              <strong>{n.title}</strong>
            )}
            <p className="meta">
              {n.publisher || "來源未知"}
              {n.published_at ? ` · ${new Date(n.published_at).toLocaleString()}` : ""}
            </p>
            {n.summary && <p className="reason">{n.summary}</p>}
          </article>
        ))}
      </section>

      <p className="disclaimer">{data.disclaimer}</p>
    </section>
  );
}
