"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchBacktest } from "@/lib/api";
import type { BacktestResponse, BacktestHorizon } from "@/lib/types";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "" }) {
  return (
    <div className="pillar-item">
      <span>{label}</span>
      <strong className={tone || ""}>{value}</strong>
    </div>
  );
}

function fmt(n: number | null | undefined, suffix = "%") {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}${suffix}`;
}

function HorizonCard({ h, title }: { h: BacktestHorizon; title: string }) {
  const chase = h.chase;
  const limit = h.limit;
  const spy = h.spy;
  return (
    <article className="learn-card" style={{ marginBottom: 12 }}>
      <h3>
        {title} · 持有 {h.hold_days} 日
      </h3>
      <div className="pillar-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <Stat label="追價樣本" value={`${chase.n}`} />
        <Stat
          label="追價平均"
          value={fmt(chase.avg_return_pct)}
          tone={(chase.avg_return_pct ?? 0) >= 0 ? "up" : "down"}
        />
        <Stat label="追價勝率" value={chase.win_rate_pct != null ? `${chase.win_rate_pct}%` : "—"} />
        <Stat
          label="vs SPY"
          value={fmt(h.chase_minus_spy_pct)}
          tone={(h.chase_minus_spy_pct ?? 0) >= 0 ? "up" : "down"}
        />
        <Stat label="限價樣本" value={`${limit.n}`} />
        <Stat
          label="限價平均"
          value={fmt(limit.avg_return_pct)}
          tone={(limit.avg_return_pct ?? 0) >= 0 ? "up" : "down"}
        />
        <Stat label="限價勝率" value={limit.win_rate_pct != null ? `${limit.win_rate_pct}%` : "—"} />
        <Stat
          label="SPY 同期"
          value={fmt(spy.avg_return_pct)}
          tone={(spy.avg_return_pct ?? 0) >= 0 ? "up" : "down"}
        />
      </div>
      <p className="group-footer" style={{ margin: "8px 0 0" }}>
        追價最差／最好：{fmt(chase.worst_trade_pct)} / {fmt(chase.best_trade_pct)} · 限價最差／最好：
        {fmt(limit.worst_trade_pct)} / {fmt(limit.best_trade_pct)}
      </p>
    </article>
  );
}

function ModeBlock({
  label,
  block,
}: {
  label: string;
  block: BacktestResponse["short"];
}) {
  if (!block) return null;
  return (
    <>
      <p className="group-header">{label}</p>
      <div className="inset-list" style={{ marginBottom: 12 }}>
        <div className="inset-row">
          <dt>訊號數</dt>
          <dd>{block.signals}</dd>
        </div>
        <div className="inset-row">
          <dt>限價成交</dt>
          <dd>
            {block.limit_fills}
            {block.limit_fill_rate_pct != null ? `（${block.limit_fill_rate_pct}%）` : ""}
          </dd>
        </div>
        <div className="inset-row">
          <dt>股票數</dt>
          <dd>{block.tickers_used}</dd>
        </div>
      </div>
      {block.horizons.map((h) => (
        <HorizonCard key={`${label}-${h.hold_days}`} h={h} title={label} />
      ))}
    </>
  );
}

export default function BacktestPage() {
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchBacktest();
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "載入失敗");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1 className="large-title">回測</h1>
      <p className="page-sub">
        驗證而家「買」訊號之後點走——策略健康檢查，唔係逐隻股排行。
      </p>

      {error && <div className="state-box error">{error}</div>}
      {!data && !error && (
        <div className="group">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}

      {data && (
        <>
          <p className="group-header">說明</p>
          <article className="learn-card">
            <ul className="learn-list">
              {(data.notes || []).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="learn-tip">
              框架 {data.framework || "—"} · 樣本期 {data.period || "—"}
              {data.updated_at_iso ? ` · 更新 ${new Date(data.updated_at_iso).toLocaleString()}` : ""}
            </p>
          </article>

          {data.status === "warming_up" && (
            <div className="state-box">{data.message || "回測資料準備中"}</div>
          )}

          <ModeBlock label="短線策略" block={data.short} />
          <ModeBlock label="長線策略" block={data.long} />

          <p className="group-footer">
            想知點用呢啲數字 → <Link href="/learn#backtest">知識 · 回測</Link>
            。想睇而家訊號 → <Link href="/short">短線</Link> / <Link href="/long">長線</Link>。
          </p>
          {data.disclaimer && <p className="group-footer">{data.disclaimer}</p>}
        </>
      )}
    </section>
  );
}
