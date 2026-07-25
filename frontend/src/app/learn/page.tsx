import Link from "next/link";

export default function LearnPage() {
  return (
    <section>
      <h1 className="large-title">知識</h1>
      <p className="page-sub">
        深度教學：stockIO 用「多因子混搭」框架，結合學術常見因子同實務技術確認法，而唔係單一指標。
      </p>

      <p className="group-header">目錄</p>
      <div className="inset-list learn-toc">
        <a className="news-row" href="#why">
          <strong>1. 點解要混搭？</strong>
          <p className="meta">單一指標不可靠嘅原因</p>
        </a>
        <a className="news-row" href="#framework">
          <strong>2. stockIO 多因子框架</strong>
          <p className="meta">短線 5 柱 · 長線雙動能+質素</p>
        </a>
        <a className="news-row" href="#research">
          <strong>3. 研究靈感從邊嚟</strong>
          <p className="meta">學術 / 實務概念（精簡）</p>
        </a>
        <a className="news-row" href="#short">
          <strong>4. 短線每柱點計</strong>
          <p className="meta">趨勢·動量·量能·結構·風險</p>
        </a>
        <a className="news-row" href="#long">
          <strong>5. 長線每柱點計</strong>
          <p className="meta">絕對/相對動能·質素</p>
        </a>
        <a className="news-row" href="#sr">
          <strong>6. 支撐 / 阻力</strong>
          <p className="meta">詳解 + 點用</p>
        </a>
        <a className="news-row" href="#chart">
          <strong>7. 圖表圖例</strong>
          <p className="meta">價·MA·虛線</p>
        </a>
        <a className="news-row" href="#limits">
          <strong>8. 限制同正確心態</strong>
          <p className="meta">可信度邊界</p>
        </a>
      </div>

      <p id="why" className="group-header">
        1. 點解要混搭？（唔好信單一指標）
      </p>
      <article className="learn-card">
        <p>
          只睇 RSI、或者只睇一條均線，好易「假訊號」。實務上較穩陣嘅做法係：
          <strong>唔同類資訊互相確認</strong>——趨勢答「方向」、動量答「力道」、成交量答「有冇人參與」、結構答「價位優唔優」、風險答「波幅大唔大」。
        </p>
        <p>
          學術同機構常用嘅「多因子」思維亦類似：Value / Quality / Momentum / Low-volatility
          等因子本身有週期性，單因子會長時間失效；混搭可以降低單一風格嘅回撤（常見討論見 Asness 等關於 multi-factor 嘅研究脈絡，以及 Fama–French / Carhart 動量因子傳統）。
        </p>
        <p className="learn-tip">stockIO 短線偏「技術確認混搭」；長線偏「趨勢+相對動能（雙動能味）+ 可選基本面質素」。</p>
      </article>

      <p id="framework" className="group-header">
        2. stockIO 而家嘅框架（v2）
      </p>
      <article className="learn-card">
        <h3>短線：五柱加權</h3>
        <div className="inset-list" style={{ margin: "10px 0 14px" }}>
          <div className="inset-row">
            <dt>趨勢 Trend 30%</dt>
            <dd>MA20/50/200、均線排列</dd>
          </div>
          <div className="inset-row">
            <dt>動量 Momentum 25%</dt>
            <dd>RSI、MACD、近況回報、距52週高</dd>
          </div>
          <div className="inset-row">
            <dt>量能 Volume 20%</dt>
            <dd>放量上攻 / 放量下跌</dd>
          </div>
          <div className="inset-row">
            <dt>結構 Structure 15%</dt>
            <dd>距離支撐 / 阻力</dd>
          </div>
          <div className="inset-row">
            <dt>風險 Risk 10%</dt>
            <dd>ATR 波幅、近月回撤</dd>
          </div>
        </div>
        <h3>長線：雙動能 + 風險（詳情頁可加質素）</h3>
        <ul className="learn-list">
          <li>
            <strong>絕對動能</strong>：價 vs MA200 / MA50（趨勢跟隨）
          </li>
          <li>
            <strong>相對動能</strong>：近月表現 vs SPY（強弱比較）
          </li>
          <li>
            <strong>中期動量</strong>：近月 / 近季回報 + 唔好過熱
          </li>
          <li>
            <strong>風險</strong>：ATR 波幅是否極端
          </li>
          <li>
            <strong>質素/估值</strong>（詳情頁）：ROE、利潤率、PE、槓桿（有數據先計）
          </li>
        </ul>
        <p>
          最終分數 0–100 → <strong>買 / 持有 / 避開</strong>。短線買約 ≥70；長線較嚴約 ≥72。
        </p>
        <p className="learn-tip">
          詳情頁會顯示各柱分數，方便你睇「邊度強、邊度弱」，而唔止一個總分。
        </p>
      </article>

      <p id="research" className="group-header">
        3. 研究靈感（精簡、可追溯概念）
      </p>
      <article className="learn-card">
        <ul className="learn-list">
          <li>
            <strong>Trend + Momentum + Volume confirmation</strong>：實務教科書式「跨類別確認」，避免疊幾個同類震盪指標。
          </li>
          <li>
            <strong>Dual momentum 味道</strong>：同時要求「自己向上」（絕對）同「強過基準」（相對）——接近 Gary Antonacci 雙動能嘅精神，但實作簡化成 MA200 + vs SPY。
          </li>
          <li>
            <strong>Cross-sectional momentum</strong>：接近 52 週高、近月/近季強勢，呼應動量因子文獻（例如 Carhart 動量傳統）。
          </li>
          <li>
            <strong>Quality / Value soft overlay</strong>：詳情頁用 ROE、利潤率、PE、負債作質素/估值微調（Quality–Value 多因子思維嘅零售簡化版）。
          </li>
          <li>
            <strong>Low-volatility awareness</strong>：ATR 過高扣分，呼應低波幅因子「極端波動唔一定好」。
          </li>
          <li>
            <strong>基本面+技術混合篩選</strong>：有實證討論指混合過濾可改善風險調整後表現（唔保證未來）。
          </li>
        </ul>
        <p>
          重要：以上係<strong>設計靈感</strong>，stockIO 並非完整複製任何論文策略，亦冇做完整樣本外回測保證。
        </p>
      </article>

      <p id="short" className="group-header">
        4. 短線每一柱詳解
      </p>
      <article className="learn-card">
        <h3>趨勢（Trend）</h3>
        <p>
          MA20 / MA50 代表短中線平均成本。價企穩線上偏多；跌破偏淡。若出現「價 &gt; MA20 &gt; MA50」多頭排列，趨勢更乾淨。若同時喺 MA200 之上，代表短線順住大趨勢，假突破機會較低（仍會發生）。
        </p>
        <h3>動量（Momentum）</h3>
        <p>
          RSI 睇過熱／回調；MACD 睇動能方向；近 5/20 日回報睇近期力度；距 52 週高睇係咪市場寵兒（相對強勢股常靠近高位運行）。超買一樣可以繼續升，所以要同趨勢柱一齊睇。
        </p>
        <h3>量能（Volume）</h3>
        <p>
          「價升要有量」係經典確認。放量上升較似真需求；放量下跌較似真拋壓。縮量波動可信度較低。
        </p>
        <h3>結構（Structure）</h3>
        <p>
          用支撐／阻力距離評估「位置好唔好」。接近支撐可能係較佳觀察位；貼住阻力則冲關失敗風險高。詳見下一節。
        </p>
        <h3>風險（Risk）</h3>
        <p>
          ATR% 量度日波動。適中波幅較易管理；極高波幅代表倉位風險大。近月回撤太深亦會扣分。
        </p>
      </article>

      <p id="long" className="group-header">
        5. 長線每一柱詳解
      </p>
      <article className="learn-card">
        <h3>絕對動能 / 趨勢</h3>
        <p>
          MA200 常被視為長線牛熊分界參考。價喺線上＝多數時間傾向持有風險資產；線下則偏防守。MA50 vs MA200 結構類似「金叉/死叉」氣味。
        </p>
        <h3>相對動能</h3>
        <p>
          同 SPY 比近月表現：強過大市＝資金相對青睞；弱過大市＝就算大市升你都可能落後。
        </p>
        <h3>質素 / 估值（詳情頁）</h3>
        <p>
          ROE、利潤率偏高通常代表賺錢能力較穩；PE 極高要小心「好故事貴價錢」；負債過高喺加息或衰退期較痛。ETF 多數冇完整公司質素數據。
        </p>
      </article>

      <p id="sr" className="group-header">
        6. 支撐 / 阻力（詳細）
      </p>
      <article className="learn-card">
        <h3>定義</h3>
        <ul className="learn-list">
          <li>
            <strong>支撐 Support</strong>：價格下跌時較易遇到買盤、停住或反彈嘅區域（好似彈床）。
          </li>
          <li>
            <strong>阻力 Resistance</strong>：價格上升時較易遇到賣盤、受阻回落嘅區域（好似天花）。
          </li>
        </ul>
        <h3>點解會存在？</h3>
        <p>
          因為人類同演算法都會喺前高、前低、整數關、均線附近掛單。交易密集區形成「記憶」。跌穿支撐後，舊支撐常變新阻力；升穿阻力後，舊阻力常變新支撐。
        </p>
        <h3>stockIO 點畫？</h3>
        <p>結合近期高低（約 40 日）+ 樞軸點（Pivot）估算。圖上：綠虛線＝支撐，紅虛線＝阻力。</p>
        <h3>點用（實務）</h3>
        <ul className="learn-list">
          <li>偏多訊號 + 接近支撐：較佳觀察／試倉區（仍要管風險）</li>
          <li>已大升 + 貼阻力：小心冲關失敗</li>
          <li>止蝕參考：可放喺支撐之下（唔係保證）</li>
        </ul>
      </article>

      <p id="chart" className="group-header">
        7. 走勢圖圖例
      </p>
      <article className="learn-card">
        <ul className="learn-list">
          <li>
            <strong>面積線</strong>：股價（升綠／跌紅）
          </li>
          <li>
            <strong>藍線 MA20</strong>：短線趨勢
          </li>
          <li>
            <strong>紫線 MA50</strong>：中線趨勢
          </li>
          <li>
            <strong>虛線</strong>：支撐（綠）／阻力（紅）
          </li>
        </ul>
        <p>約 6 個月日線。可拖動。MA20 上穿 MA50 只係眾多確認之一，唔應單獨決策。</p>
      </article>

      <p id="limits" className="group-header">
        8. 可信度邊界（一定要讀）
      </p>
      <article className="learn-card">
        <ul className="learn-list">
          <li>數據來自公開行情（Yahoo 非官方），可能延遲或不完整。</li>
          <li>規則型分數 ≠ 預言；黑天鵝、政策、財報地雷可瞬間打破技術結構。</li>
          <li>無完整機構級風控、無保證回測優勝。</li>
          <li>最適合：學習框架 + 縮小觀察名單 + 自己再驗證。</li>
        </ul>
        <p className="learn-tip">今晚贏鋪大,老婆仔女攞去賣!</p>
      </article>

      <p className="group-footer">
        下一步：去 <Link href="/short">短線</Link> 開一隻股詳情，對住「五柱分數」同本頁一齊睇。想長線就去{" "}
        <Link href="/long">長線</Link>。
      </p>
    </section>
  );
}
