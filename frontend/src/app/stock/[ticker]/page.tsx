"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchStock } from "@/lib/api";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { loadWatchlist, toggleWatch } from "@/lib/watchlist";
import { LabelBadge } from "@/components/LabelBadge";
import { StockChart } from "@/components/StockChart";
import { InfoTip } from "@/components/InfoTip";
import { PriceChange } from "@/components/PriceChange";
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

function fmtTime(iso?: string | null, unix?: number | null) {
  const d = iso ? new Date(iso) : unix != null ? new Date(unix * 1000) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-HK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
            ? "暫不買入"
            : null;
  const buyBelow = levels.buy != null && levels.buy < price * 0.995;
  return (
    <>
      <div className="inset-row">
        <dt>
          <InfoTip label="建議買入">
            演算法喺支撐、均線同 ATR 波幅交匯處，計出限價回調區間嘅中位；預設唔追現價。
          </InfoTip>
        </dt>
        <dd className="up">
          {levels.buy != null
            ? `$${levels.buy.toFixed(2)}${buyBelow ? "（限價）" : ""}`
            : "暫不買"}
        </dd>
      </div>
      <div className="inset-row">
        <dt>
          <InfoTip label="買入區間">
            折讓區（支撐至區間約中下段）同均線回調位嘅重疊範圍；落喺區間內先考慮入場。
          </InfoTip>
        </dt>
        <dd>{zone}</dd>
      </div>
      <div className="inset-row">
        <dt>
          <InfoTip label="目標價">
            優先取上方阻力；若風險報酬不足，會提高到約買入價＋2×風險距離，目標約 2:1。
          </InfoTip>
        </dt>
        <dd className="down">{levels.sell != null ? `$${levels.sell.toFixed(2)}` : "—"}</dd>
      </div>
      <div className="inset-row">
        <dt>
          <InfoTip label="止蝕參考">
            大致設喺支撐下方約 0.5–1×ATR，並確保相對買入價有足夠緩衝，避免止蝕過窄。
          </InfoTip>
        </dt>
        <dd>{levels.stop != null ? `$${levels.stop.toFixed(2)}` : "—"}</dd>
      </div>
      {levels.risk_reward != null && (
        <div className="inset-row">
          <dt>
            <InfoTip label="風險報酬">
              （目標價 − 買入）÷（買入 − 止蝕）。約 2:1 即潛在賺約兩倍於虧損距離。
            </InfoTip>
          </dt>
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

function ScoreRow({ score, kind }: { score: number; kind: "short" | "long" }) {
  return (
    <div className="inset-row">
      <dt>
        <InfoTip label={kind === "short" ? "短線分數" : "長線分數"}>
          {kind === "short" ? (
            <>
              範圍 <strong>0–100</strong>。綜合短線趨勢（均線）、動量（RSI／MACD／回報）、量能、
              支撐阻力結構同波幅風險。約 ≥70 偏「買」、≤40 偏「避開」，中間偏「持有」。需多柱確認先會標「買」。
            </>
          ) : (
            <>
              範圍 <strong>0–100</strong>。綜合相對 SPY 動能、質素（ROE／利潤率等）、長線均線同機構
              13F 資金流。約 ≥70 偏「買」、≤40 偏「避開」。呢啲係演算法訊號，唔係分析師評級。
            </>
          )}
        </InfoTip>
      </dt>
      <dd>
        {score.toFixed(0)}
        <span className="score-range-hint"> / 100</span>
      </dd>
    </div>
  );
}

export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params?.ticker || "").toUpperCase();
  const [payload, setPayload] = useState<StockDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wlEpoch, setWlEpoch] = useState(0);
  const watched = useMemo(() => {
    void wlEpoch;
    return ticker ? loadWatchlist().includes(ticker) : false;
  }, [ticker, wlEpoch]);
  const hasDataRef = useRef(false);

  useEffect(() => {
    hasDataRef.current = false;
  }, [ticker]);

  const reloadQuote = useCallback(async () => {
    if (!ticker) return;
    try {
      const d = await fetchStock(ticker);
      hasDataRef.current = true;
      setPayload(d);
      setError(null);
    } catch (e) {
      if (!hasDataRef.current) {
        setError(e instanceof Error ? e.message : "載入失敗");
      }
    }
  }, [ticker]);

  useAutoRefresh(reloadQuote, {
    enabled: !!ticker,
    watchKey: ticker,
  });

  // Stale payload from previous ticker — show loading until matching data arrives
  const data = payload && payload.ticker === ticker ? payload : null;

  if (error && !data) {
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

  // One canonical current-price object for the whole page
  const quote = data.quote ?? {
    price: data.price,
    change_pct: data.change_pct,
    as_of: data.as_of ?? 0,
    as_of_iso: data.as_of_iso ?? "",
    source: "legacy",
    source_label: data.data_source ?? "報價",
    market_state: data.market?.state ?? "UNKNOWN",
    session_label: data.market?.session_label ?? "時段未知",
    stale: true,
  };
  const price = quote.price;
  const changePct = quote.change_pct;
  const up = changePct > 0;
  const down = changePct < 0;
  const sr = data.support_resistance;
  const snap = data.snapshot as {
    ma20?: number;
    ma50?: number;
    ma200?: number | null;
    rsi?: number;
    macd?: number;
    macd_hist?: number;
  };

  return (
    <section>
      <div className="page-toolbar" style={{ marginBottom: 4 }}>
        <Link href="/short" className="back-link" style={{ margin: 0 }}>
          ‹ 市場
        </Link>
        <button
          type="button"
          className={watched ? "btn btn-ghost" : "btn"}
          onClick={() => {
            toggleWatch(data.ticker);
            setWlEpoch((n) => n + 1);
          }}
        >
          {watched ? "已關注" : "加關注"}
        </button>
      </div>

      <div className="detail-hero">
        <h1 className="symbol">{data.ticker}</h1>
        <div className="price-line">
          <span className="price">${price.toFixed(2)}</span>
          <PriceChange pct={changePct} />
        </div>
        <p className="quote-meta">
          <span>{quote.session_label}</span>
          <span aria-hidden="true"> · </span>
          <span>更新 {fmtTime(quote.as_of_iso, quote.as_of)}</span>
          <span aria-hidden="true"> · </span>
          <span>{quote.source_label}</span>
          {quote.stale && <span className="stale-tag">（備用）</span>}
        </p>
      </div>

      <p className="lang-note" role="note">
        介面語言：繁體中文（粵語口語）。若瀏覽器出現「翻譯」／「翻譯此頁」，請關閉，以免標籤被改壞。
      </p>

      <p className="signal-disclaimer" role="note">
        {data.signal_disclaimer ||
          "以下「買／持有／避開」同分數均為程式演算法訊號，並非分析師評級或投資建議。"}
      </p>

      {data.chart && data.chart.price.length > 0 && (
        <>
          <p className="group-header">走勢圖</p>
          <StockChart data={data.chart} up={up || (!up && !down)} />
        </>
      )}

      <p className="group-header">技術指標</p>
      <div className="inset-list">
        <div className="inset-row">
          <dt>
            <InfoTip label="MA20">
              20 日簡單移動平均線，約反映一個月短線趨勢。現價企穩上方通常偏多。
            </InfoTip>
          </dt>
          <dd>{snap.ma20 != null ? `$${Number(snap.ma20).toFixed(2)}` : "—"}</dd>
        </div>
        <div className="inset-row">
          <dt>
            <InfoTip label="MA50">
              50 日均線，中期趨勢參考。短線回調常見會測試呢條線。
            </InfoTip>
          </dt>
          <dd>{snap.ma50 != null ? `$${Number(snap.ma50).toFixed(2)}` : "—"}</dd>
        </div>
        <div className="inset-row">
          <dt>
            <InfoTip label="MA200">
              200 日均線，長線牛熊分界常見參考。長線分數會較着重呢條線。
            </InfoTip>
          </dt>
          <dd>{snap.ma200 != null ? `$${Number(snap.ma200).toFixed(2)}` : "—"}</dd>
        </div>
        <div className="inset-row">
          <dt>
            <InfoTip label="RSI">
              相對強弱指數（0–100）。傳統上 &gt;70 偏超買、&lt;30 偏超賣；需配合趨勢，唔好單睇。
            </InfoTip>
          </dt>
          <dd>{snap.rsi != null ? Number(snap.rsi).toFixed(1) : "—"}</dd>
        </div>
        <div className="inset-row">
          <dt>
            <InfoTip label="MACD">
              指數平滑異同移動平均。柱狀圖（Hist）由負轉正常見作動能轉折參考；呢度顯示最近 MACD 同 Hist。
            </InfoTip>
          </dt>
          <dd>
            {snap.macd != null ? Number(snap.macd).toFixed(3) : "—"}
            {snap.macd_hist != null ? `（Hist ${Number(snap.macd_hist).toFixed(3)}）` : ""}
          </dd>
        </div>
        <p className="quote-meta" style={{ padding: "4px 16px 10px" }}>
          現價 ${price.toFixed(2)} · {quote.source_label} · {fmtTime(quote.as_of_iso, quote.as_of)}
        </p>
      </div>

      <p className="group-header">短線建議（演算法）</p>
      <div className="inset-list">
        <div className="inset-row">
          <dt>標籤</dt>
          <dd>
            <LabelBadge label={data.short.label} />
            <span className="algo-tag">演算法</span>
          </dd>
        </div>
        <ScoreRow score={data.short.score} kind="short" />
        <div className="inset-row">
          <dt>原因</dt>
          <dd style={{ maxWidth: "60%" }}>{data.short.reason}</dd>
        </div>
        <div className="inset-row">
          <dt>觀察期</dt>
          <dd>{data.short.hold_period}</dd>
        </div>
        <LevelsBlock levels={data.short.levels} price={price} />
        {data.short.pillars && (
          <div className="pillar-grid">
            {Object.entries(data.short.pillars)
              .filter(([, v]) => v != null)
              .map(([k, v]) => (
                <div key={k} className="pillar-item">
                  <span>{pillarName(k)}</span>
                  <strong
                    className={(v as number) >= 60 ? "up" : (v as number) <= 40 ? "down" : ""}
                    aria-label={`${pillarName(k)} ${(v as number).toFixed(0)} 分${
                      (v as number) >= 60 ? "（偏強）" : (v as number) <= 40 ? "（偏弱）" : ""
                    }`}
                  >
                    {(v as number).toFixed(0)}
                    <span className="sr-only">
                      {(v as number) >= 60 ? " 偏強" : (v as number) <= 40 ? " 偏弱" : ""}
                    </span>
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

      <p className="group-header">長線建議（演算法）</p>
      <div className="inset-list">
        <div className="inset-row">
          <dt>標籤</dt>
          <dd>
            <LabelBadge label={data.long.label} />
            <span className="algo-tag">演算法</span>
          </dd>
        </div>
        <ScoreRow score={data.long.score} kind="long" />
        <div className="inset-row">
          <dt>原因</dt>
          <dd style={{ maxWidth: "60%" }}>{data.long.reason}</dd>
        </div>
        <div className="inset-row">
          <dt>觀察期</dt>
          <dd>{data.long.hold_period}</dd>
        </div>
        <LevelsBlock levels={data.long.levels} price={price} />
        {data.long.pillars && (
          <div className="pillar-grid">
            {Object.entries(data.long.pillars)
              .filter(([, v]) => v != null)
              .map(([k, v]) => (
                <div key={k} className="pillar-item">
                  <span>{pillarName(k)}</span>
                  <strong
                    className={(v as number) >= 60 ? "up" : (v as number) <= 40 ? "down" : ""}
                    aria-label={`${pillarName(k)} ${(v as number).toFixed(0)} 分`}
                  >
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
          <p className="group-header">
            <InfoTip label="機構動向（13F）">
              美國機構投資者按 SEC 規定每季提交嘅 13F 持股披露。滯後約一季，反映大型基金增減倉傾向，唔係即時買賣訊號。
            </InfoTip>
          </p>
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
                {data.institutional.net_pct_change != null ? (
                  <>
                    <span aria-hidden="true">
                      {data.institutional.net_pct_change > 0
                        ? "▲ "
                        : data.institutional.net_pct_change < 0
                          ? "▼ "
                          : ""}
                    </span>
                    {`${data.institutional.net_pct_change > 0 ? "+" : ""}${data.institutional.net_pct_change.toFixed(2)}%`}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="inset-row">
              <dt>增持 / 減持</dt>
              <dd>
                <span className="up">增 {data.institutional.increasers}</span>
                {" / "}
                <span className="down">減 {data.institutional.decreasers}</span>
              </dd>
            </div>
            {data.institutional.flow_score != null && (
              <div className="inset-row">
                <dt>
                  <InfoTip label="資金流分數">
                    由 13F 增減持比例推算，範圍約 0–100；愈高表示機構淨增持傾向愈強。
                  </InfoTip>
                </dt>
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
                  <span className="score-range-hint"> / 100</span>
                </dd>
              </div>
            )}
            {data.institutional.report_date && (
              <div className="inset-row">
                <dt>報告期</dt>
                <dd>{new Date(data.institutional.report_date).toLocaleDateString("zh-HK")}</dd>
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
                    <span
                      className={h.pct_change > 0 ? "up" : h.pct_change < 0 ? "down" : ""}
                      aria-label={`${h.pct_change > 0 ? "增" : h.pct_change < 0 ? "減" : "平"} ${fmtPct(h.pct_change)}`}
                    >
                      <span aria-hidden="true">
                        {h.pct_change > 0 ? "▲ " : h.pct_change < 0 ? "▼ " : ""}
                      </span>
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
          <dt>
            <InfoTip label="現價">
              同頁面頂部共用同一個報價來源，避免標題同結構位用唔同價格。
            </InfoTip>
          </dt>
          <dd>${price.toFixed(2)}</dd>
        </div>
        <div className="inset-row">
          <dt>
            <InfoTip label="支撐">
              現價<strong>下方</strong>最近嘅結構位（近期擺動低點／樞軸），距離至少約 0.8% 或
              0.5×ATR，避免把昨日低點當支撐。跌破後可能暫時顯示「暫無」。
            </InfoTip>
          </dt>
          <dd>
            {sr.support_valid && sr.support != null ? `$${sr.support.toFixed(2)}` : "暫無有效支撐"}
          </dd>
        </div>
        <div className="inset-row">
          <dt>
            <InfoTip label="阻力">
              現價<strong>上方</strong>最近嘅結構位（近期擺動高點／樞軸）。接近區間高位時可能暫時無有效阻力——呢個係正常，唔係壞數據。
            </InfoTip>
          </dt>
          <dd>
            {sr.resistance_valid && sr.resistance != null
              ? `$${sr.resistance.toFixed(2)}`
              : "暫無有效阻力"}
          </dd>
        </div>
        <div className="inset-row">
          <dt>樞軸</dt>
          <dd>${sr.pivot.toFixed(2)}</dd>
        </div>
        <div className="inset-row">
          <dt>距支撐</dt>
          <dd>
            {sr.distance_to_support_pct != null ? `${sr.distance_to_support_pct.toFixed(2)}%` : "—"}
          </dd>
        </div>
        <div className="inset-row">
          <dt>距阻力</dt>
          <dd>
            {sr.distance_to_resistance_pct != null
              ? `${sr.distance_to_resistance_pct.toFixed(2)}%`
              : "—"}
          </dd>
        </div>
        <p className="quote-meta" style={{ padding: "4px 16px 8px" }}>
          {quote.source_label} · 更新 {fmtTime(quote.as_of_iso, quote.as_of)}
        </p>
      </div>
      <p className="group-footer">
        {sr.note ||
          "接近支撐或有反彈空間；接近阻力要小心冲關失敗。"}{" "}
        想知詳情去 <Link href="/learn#sr">知識 · 支撐/阻力</Link>。
      </p>

      <p className="group-header">財報</p>
      <div className="inset-list">
        {data.earnings.next_earnings ? (
          <>
            <div className="inset-row">
              <dt>下次財報</dt>
              <dd>{new Date(data.earnings.next_earnings.date).toLocaleString("zh-HK")}</dd>
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
            <dt>{new Date(e.date).toLocaleDateString("zh-HK")}</dt>
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
              {n.published_at ? ` · ${new Date(n.published_at).toLocaleString("zh-HK")}` : ""}
            </p>
          </a>
        ))}
      </div>

      {data.disclaimer && <p className="group-footer">{data.disclaimer}</p>}
      <p className="group-footer">
        資料來源：{quote.source_label}。詳情頁即時重計（含質素／機構）；列表分數嚟自定時掃描（偏技術）。兩者可能略有差別。演算法訊號 ≠ 分析師推薦。
      </p>
    </section>
  );
}
