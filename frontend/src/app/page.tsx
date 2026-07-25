import Link from "next/link";
import { APP_RELEASE_NAME, APP_VERSION_LABEL } from "@/lib/version";

export default function HomePage() {
  return (
    <section>
      <div className="hero-card">
        <p className="hero-kicker">MARKETS · {APP_VERSION_LABEL}</p>
        <h1>stockIO</h1>
        <p>掃描美股市場，用技術同趨勢畀你清晰建議。加入主畫面。</p>
      </div>

      <p className="group-header">快速開始</p>
      <div className="quick-grid">
        <Link href="/short" className="quick-link" style={{ animationDelay: "0.05s" }}>
          <span className="quick-icon blue">↗</span>
          <div>
            <strong>短線</strong>
            <span>3–10 個交易日技術訊號</span>
          </div>
        </Link>
        <Link href="/long" className="quick-link" style={{ animationDelay: "0.1s" }}>
          <span className="quick-icon green">◇</span>
          <div>
            <strong>長線</strong>
            <span>ETF 同趨勢配置</span>
          </div>
        </Link>
        <Link href="/watchlist" className="quick-link" style={{ animationDelay: "0.15s" }}>
          <span className="quick-icon orange">★</span>
          <div>
            <strong>關注</strong>
            <span>你自己嘅清單</span>
          </div>
        </Link>
        <Link href="/learn" className="quick-link" style={{ animationDelay: "0.2s" }}>
          <span className="quick-icon gray">？</span>
          <div>
            <strong>知識</strong>
            <span>新手教學 · 指標解釋</span>
          </div>
        </Link>
      </div>

      <p className="group-header">點樣用</p>
      <div className="inset-list">
        <div className="inset-row">
          <dt>主動推介</dt>
          <dd>唔使先揀股</dd>
        </div>
        <div className="inset-row">
          <dt>建議格式</dt>
          <dd>買 / 持有 / 避開</dd>
        </div>
        <div className="inset-row">
          <dt>詳情包含</dt>
          <dd>支撐 · 財報 · 新聞 · 機構 · 限價</dd>
        </div>
        <div className="inset-row">
          <dt>更新</dt>
          <dd>報價約 3 分鐘</dd>
        </div>
        <div className="inset-row">
          <dt>版本</dt>
          <dd>
            {APP_VERSION_LABEL} · {APP_RELEASE_NAME}
          </dd>
        </div>
        <div className="inset-row">
          <dt>策略回測</dt>
          <dd>
            <Link href="/backtest">睇成績</Link>
          </dd>
        </div>
      </div>
      <p className="group-footer">今晚贏鋪大,老婆仔女攞去賣!</p>
    </section>
  );
}
