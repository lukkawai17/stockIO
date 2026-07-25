"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchStock } from "@/lib/api";
import { loadWatchlist, toggleWatch } from "@/lib/watchlist";
import { LabelBadge } from "@/components/LabelBadge";
import { StockChart } from "@/components/StockChart";
import type { StockDetail } from "@/lib/types";

function pillarName(key: string) {
  const map: Record<string, string> = {
    trend: "趨勢",
    momentum: "動量",
    volume: "量能",
    structure: "結構",
    risk: "風險",
    relative: "相對",
    quality: "質素",
    institutional: "機構",
  };
  return map[key] || key;
}

function fmtPct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

function LevelsBlock({
  levels,
  price,
}: {
  levels?: {
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
  price: number;
}) {
  if (!levels) return null;
  const zone =
    levels.buy_low != null && levels.buy_high != null
      ? `$${levels.buy_low.toFixed(2)} – $${levels.buy_high.toFixed(2)}`
      : "—";
  const modeLabel =
    levels.entry_mode === "wait_premium"
      ? "等回調（偏貴區）"
      : levels.entry_mode === "in_zone"
        ? "已喺折讓區"
        : levels.entry_mode === "limit_pullback"
          ? "限價回調"
          : levels.entry_mode === "avoid"
            ? "暂不買入"
            : null;
  const buyBelow = levels.buy != null && levels.buy < price * 0.995;
  return (
    <>
      <div className="inset-row">
        <dt>建議買入</dt>
        <dd className="up">
          {levels.buy != null ? `$${levels.buy.toFixed(2)}${buyBelow ? "（限價）" : ""}` : "暫不買"}
        </dd>
      </div>
      <div className="inset-row">
        <dt>買入區間</dt>
        <dd>{zone}</dd>
      </div>
      <div className="inset-row">
        <dt>建議賣出</dt>
        <dd className="down">{levels.sell != null ? `$${levels.sell.toFixed(2)}` : "—"}</dd>
      </div>
      <div className="inset-row">
        <dt>止蝕參考</dt>
        <dd>{levels.stop != null ? `$${levels.stop.toFixed(2)}` : "—"}</dd>
      </div>
      {levels.risk_reward != null && (
        <div className="inset-row">
          <dt>風險報酬</dt>
          <dd>約 {levels.risk_reward.toFixed(1)} : 1</dd>
        </div>
      )}
      {modeLabel && (
        <div className="inset-row">
          <dt>入場方式</dt>
          <dd>{modeLabel}</dd>
        </div>
      )}
      {levels.note && (
        <p className="group-footer" style={{ margin: "4px 16px 8px" }}>
          {levels.note}
        </p>
      )}
    </>
  );
}

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
        <LevelsBlock levels={data.short.levels} price={data.price} />
        {data.short.pillars && (
          <div className="pillar-grid">
            {Object.entries(data.short.pillars)
              .filter(([, v]) => v != null)
              .map(([k, v]) => (
                <div key={k} className="pillar-item">
                  <span>{pillarName(k)}</span>
                  <strong className={(v as number) >= 60 ? "up" : (v as number) <= 40 ? "down" : ""}>
                    {(v as number).toFixed(0)}
                  </strong>
                </div>
              ))}
          </div>
        )}
        <p className="group-footer" style={{ margin: "8px 16px 12px" }}>
          {data.short.knowledge}{" "}
          <Link href="/learn#framework">了解框架</Link>
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
        <LevelsBlock levels={data.long.levels} price={data.price} />
        {data.long.pillars && (
          <div className="pillar-grid">
            {Object.entries(data.long.pillars)
              .filter(([, v]) => v != null)
              .map(([k, v]) => (
                <div key={k} className="pillar-item">
                  <span>{pillarName(k)}</span>
                  <strong className={(v as number) >= 60 ? "up" : (v as number) <= 40 ? "down" : ""}>
                    {(v as number).toFixed(0)}
                  </strong>
                </div>
              ))}
          </div>
        )}
        <p className="group-footer" style={{ margin: "8px 16px 12px" }}>
          {data.long.knowledge}{" "}
          <Link href="/learn#long">了解長線</Link>
        </p>
        <div className="signal-wrap">
          {data.long.signals.map((s) => (
            <span key={s} className="signal-chip">
              {s}
            </span>
          ))}
        </div>
      </div>

      {data.institutional && (
        <>
          <p className="group-header">機構動向（13F）</p>
          <div className="inset-list">
            <div className="inset-row">
              <dt>機構持股</dt>
              <dd>
                {data.institutional.institutions_percent != null
                  ? `${(data.institutional.institutions_percent * 100).toFixed(1)}%`
                  : "—"}
              </dd>
            </div>
            <div className="inset-row">
              <dt>機構數量</dt>
              <dd>{data.institutional.institutions_count?.toLocaleString() ?? "—"}</dd>
            </div>
            <div className="inset-row">
              <dt>加權增減</dt>
              <dd
                className={
                  (data.institutional.net_pct_change ?? 0) > 0.5
                    ? "up"
                    : (data.institutional.net_pct_change ?? 0) < -0.5
                      ? "down"
                      : ""
                }
              >
                {data.institutional.net_pct_change != null
                  ? `${data.institutional.net_pct_change > 0 ? "+" : ""}${data.institutional.net_pct_change.toFixed(2)}%`
                  : "—"}
              </dd>
            </div>
            <div className="inset-row">
              <dt>增持 / 減持</dt>
              <dd>
                <span className="up">{data.institutional.increasers}</span>
                {" / "}
                <span className="down">{data.institutional.decreasers}</span>
              </dd>
            </div>
            {data.institutional.flow_score != null && (
              <div className="inset-row">
                <dt>資金流分數</dt>
                <dd
                  className={
                    data.institutional.flow_score >= 60
                      ? "up"
                      : data.institutional.flow_score <= 40
                        ? "down"
                        : ""
                  }
                >
                  {data.institutional.flow_score.toFixed(0)}
                </dd>
              </div>
            )}
            {data.institutional.report_date && (
              <div className="inset-row">
                <dt>報告期</dt>
                <dd>{new Date(data.institutional.report_date).toLocaleDateString()}</dd>
              </div>
            )}
            <p className="group-footer" style={{ margin: "8px 16px 12px" }}>
              {data.institutional.summary}{" "}
              <Link href="/learn#institutional">了解機構數據</Link>
            </p>
            {data.institutional.holders.length > 0 && (
              <div className="inst-table">
                <div className="inst-head">
                  <span>機構</span>
                  <span>持股%</span>
                  <span>變化</span>
                </div>
                {data.institutional.holders.map((h) => (
                  <div key={h.organization} className="inst-row">
                    <span className="inst-name">{h.organization}</span>
                    <span>{(h.pct_held * 100).toFixed(2)}%</span>
                    <span className={h.pct_change > 0 ? "up" : h.pct_change < 0 ? "down" : ""}>
                      {fmtPct(h.pct_change)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
      <p className="group-footer">
        接近支撐或有反彈空間；接近阻力要小心冲關失敗。想知詳情去{" "}
        <Link href="/learn#sr">知識 · 支撐/阻力</Link>。
      </p>

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
      <p className="group-footer">
        註：詳情頁即時重計（含質素／機構）；列表分數嚟自定時掃描（偏技術）。兩者可能略有差別。
      </p>
    </section>
  );
}
