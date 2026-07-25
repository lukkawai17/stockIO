import Link from "next/link";

export default function HomePage() {
  return (
    <div className="hero">
      <h1>stockIO</h1>
      <p>
        自動掃描美股（S&P / Nasdaq / 主要 ETF），用技術指標同趨勢俾你短線同長線建議。
        加入主畫面就可以當 App 用——唔使登入。
      </p>
      <div className="hero-actions">
        <Link href="/short">睇短線建議</Link>
        <Link href="/long" className="secondary">
          睇長線 / ETF
        </Link>
        <Link href="/watchlist" className="secondary">
          我的關注
        </Link>
      </div>

      <div className="feature-grid">
        <article className="feature">
          <h3>市場主動推介</h3>
          <p>唔使先揀股。系統掃市場池，排出偏多 / 偏淡名單。</p>
        </article>
        <article className="feature">
          <h3>技術 + 知識</h3>
          <p>RSI、MACD、均線、支撐阻力、財報日期、新聞，全部喺詳情頁。</p>
        </article>
        <article className="feature">
          <h3>建議持有期</h3>
          <p>短線約 3–10 個交易日；長線用月線思維（3–12 個月）。只供參考。</p>
        </article>
      </div>

      <p className="disclaimer">
        iPhone：用 Safari 打開 → 分享 →「加入主畫面」。資料來自 Yahoo Finance（非官方），只供學習參考，唔係投資建議。
      </p>
    </div>
  );
}
