import Link from "next/link";

export default function LearnPage() {
  return (
    <section>
      <h1 className="large-title">知識</h1>
      <p className="page-sub">
        新手教學：解釋 stockIO 用緊咩分析方法、每項代表咩意思、同你喺 App 邊度見到。
      </p>

      <p className="group-header">目錄</p>
      <div className="inset-list learn-toc">
        <a className="news-row" href="#overview">
          <strong>1. App 整體點運作</strong>
          <p className="meta">掃描 → 計分 → 建議</p>
        </a>
        <a className="news-row" href="#labels">
          <strong>2. 買 / 持有 / 避開 + 分數</strong>
          <p className="meta">標籤點解會咁顯示</p>
        </a>
        <a className="news-row" href="#short">
          <strong>3. 短線技術指標</strong>
          <p className="meta">MA · RSI · MACD · 成交量 · 動量</p>
        </a>
        <a className="news-row" href="#long">
          <strong>4. 長線 / ETF 趨勢</strong>
          <p className="meta">50/200 日線 · 相對大市</p>
        </a>
        <a className="news-row" href="#sr">
          <strong>5. 支撐 / 阻力（重點）</strong>
          <p className="meta">虛線係咩、點用</p>
        </a>
        <a className="news-row" href="#chart">
          <strong>6. 走勢圖點睇</strong>
          <p className="meta">股價 · MA20 · MA50</p>
        </a>
        <a className="news-row" href="#extra">
          <strong>7. 財報 · 新聞 · 觀察期</strong>
          <p className="meta">詳情頁其他資訊</p>
        </a>
        <a className="news-row" href="#howto">
          <strong>8. 新手建議用法</strong>
          <p className="meta">實際操作流程</p>
        </a>
      </div>

      <p id="overview" className="group-header">
        1. App 整體點運作
      </p>
      <article className="learn-card">
        <p>
          stockIO 唔使你自己先揀股票。系統會掃描一個美股池（大約 S&P / Nasdaq 高流通股 + 主要
          ETF），用公開市場數據計出技術分數，再排出：
        </p>
        <ul className="learn-list">
          <li>
            <strong>偏多（買）</strong>：短線或長線結構較好
          </li>
          <li>
            <strong>偏淡（避開）</strong>：結構偏弱，宜觀望
          </li>
          <li>
            <strong>最高分</strong>：分數由高到低排序
          </li>
        </ul>
        <p>
          分數會定時更新（GitHub Actions）；開市期間報價大約每 3 分鐘刷新。你加「關注」嘅清單只存在你部手機，唔使登入。
        </p>
        <p className="learn-tip">
          喺邊度睇：底部 Tab → 短線 / 長線；撳股票進入詳情。
        </p>
      </article>

      <p id="labels" className="group-header">
        2. 買 / 持有 / 避開 + 分數
      </p>
      <article className="learn-card">
        <p>
          每隻股有一個 <strong>0–100 分</strong>。分數愈高，代表喺我哋設定嘅規則下「偏多訊號」愈多。
        </p>
        <div className="inset-list" style={{ margin: "12px 0" }}>
          <div className="inset-row">
            <dt>買</dt>
            <dd>短線約 ≥70；長線更嚴約 ≥72</dd>
          </div>
          <div className="inset-row">
            <dt>持有</dt>
            <dd>中間分數，方向未夠清晰</dd>
          </div>
          <div className="inset-row">
            <dt>避開</dt>
            <dd>短線約 ≤40；長線約 ≤42</dd>
          </div>
        </div>
        <p>
          「原因」會用一句粵語摘要（例如企穩20日線、RSI 健康、MACD 偏多）。詳情頁有完整訊號清單同簡短知識解釋。
        </p>
        <p className="learn-tip">記住：分數係規則計分，唔係保證賺錢。</p>
      </article>

      <p id="short" className="group-header">
        3. 短線技術指標（App 有用）
      </p>
      <article className="learn-card">
        <h3>移動平均線 MA（Moving Average）</h3>
        <p>
          把最近 N 日收市價平均，畫成一條「平均成本線」。stockIO 主要用：
        </p>
        <ul className="learn-list">
          <li>
            <strong>MA20</strong>：近 20 個交易日平均 → 短線趨勢
          </li>
          <li>
            <strong>MA50</strong>：近 50 日 → 中短線趨勢
          </li>
        </ul>
        <p>
          <strong>點解重要：</strong>股價企喺均線上面，多數人解讀為偏多；跌穿均線，短線轉弱機會大。App 會加分或扣分。
        </p>

        <h3>RSI（相對強弱指數）</h3>
        <p>
          量度最近升跌「力量」係咪過熱，常見用 14 日。大約解讀：
        </p>
        <ul className="learn-list">
          <li>
            <strong>約 45–65</strong>：健康偏多區間（App 會加分）
          </li>
          <li>
            <strong>&gt; 72</strong>：可能超買，小心回調（扣分）
          </li>
          <li>
            <strong>&lt; 30</strong>：超賣，可能反彈但亦可能繼續弱（短線仍偏審慎）
          </li>
        </ul>

        <h3>MACD</h3>
        <p>
          用快慢兩條指數平均線差距，睇動能方向。App 睇：
        </p>
        <ul className="learn-list">
          <li>
            <strong>MACD 線高於訊號線，柱狀為正</strong> → 偏多動能
          </li>
          <li>
            <strong>柱狀為負</strong> → 偏淡動能
          </li>
        </ul>

        <h3>近 5 日 / 20 日回報（動量）</h3>
        <p>
          簡單講：最近升得多定跌得多。短線升勢強會加分；急跌會扣分。長線頁會多用近月（約 20 日）表現。
        </p>

        <h3>成交量比率</h3>
        <p>
          今日成交量 ÷ 近 20 日平均量。若「放量上升」較可信；「放量下跌」風險較大。App 會因此加減分。
        </p>
        <p className="learn-tip">喺邊度睇：短線名單原因、詳情頁短線訊號 chips。</p>
      </article>

      <p id="long" className="group-header">
        4. 長線 / ETF 趨勢
      </p>
      <article className="learn-card">
        <h3>MA200（200 日線）</h3>
        <p>
          長線投資者好常用嘅「牛熊分界」感覺線。股價長期企喺 200 日線上，多數視為大趨勢向上；跌破則偏弱。長線計分權重好高。
        </p>
        <h3>相對大市（vs SPY）</h3>
        <p>
          SPY 大致代表美股大市。若一隻股／ETF 近月表現明顯強過 SPY，叫「相對強勢」；弱過大市則偏弱。長線頁會用呢個比較。
        </p>
        <h3>ETF 例子</h3>
        <ul className="learn-list">
          <li>
            <strong>SPY / VOO / VTI</strong>：大市
          </li>
          <li>
            <strong>QQQ</strong>：Nasdaq 科技成長
          </li>
          <li>
            <strong>XLK / XLF / XLE…</strong>：板塊輪動
          </li>
        </ul>
        <p className="learn-tip">長線建議觀察期通常以月計（例如 3–12 個月），唔好用日線情緒追高殺低。</p>
      </article>

      <p id="sr" className="group-header">
        5. 支撐 / 阻力係咩？
      </p>
      <article className="learn-card">
        <h3>用生活比喻</h3>
        <p>
          想像股價好似彈波：
        </p>
        <ul className="learn-list">
          <li>
            <strong>支撐（Support）</strong>＝地下／彈床。價錢跌到呢一帶，買盤可能出現，價格較易「彈起」。
          </li>
          <li>
            <strong>阻力（Resistance）</strong>＝天花／天花板。價錢升到呢一帶，賣盤可能增多，較易「撞到回落」。
          </li>
        </ul>

        <h3>點解會有支撐／阻力？</h3>
        <p>
          因為很多人喺相近價位買入或賣出（前低、前高、整數關口、均線附近）。交易愈多嘅價位，愈容易形成心理關口。
        </p>

        <h3>stockIO 點計？</h3>
        <p>我哋結合：</p>
        <ul className="learn-list">
          <li>近期高低點（約 40 日內）</li>
          <li>經典樞軸點（Pivot：用前一日高／低／收計）</li>
        </ul>
        <p>
          圖上會畫：
        </p>
        <ul className="learn-list">
          <li>
            <strong>綠色虛線</strong>＝支撐
          </li>
          <li>
            <strong>紅色虛線</strong>＝阻力
          </li>
        </ul>

        <h3>點樣用（新手版）</h3>
        <ul className="learn-list">
          <li>價接近支撐＋其他指標未太差 → 可能係較佳觀察位（唔等於一定買）</li>
          <li>價貼住阻力＋已經升好多 → 小心冲關失敗回落</li>
          <li>若跌穿支撐 → 支撐可能變阻力（角色互換）</li>
          <li>若升穿阻力 → 阻力可能變支撐</li>
        </ul>
        <p className="learn-tip">
          詳情頁「支撐 / 阻力」區塊會顯示實際價錢同距離百分比。
        </p>
      </article>

      <p id="chart" className="group-header">
        6. 走勢圖點睇
      </p>
      <article className="learn-card">
        <ul className="learn-list">
          <li>
            <strong>面積線（綠/紅）</strong>：股價本身；升用綠、跌用紅
          </li>
          <li>
            <strong>藍色線 MA20</strong>：短線趨勢。價喺線上較偏多
          </li>
          <li>
            <strong>紫色線 MA50</strong>：中線趨勢
          </li>
          <li>
            <strong>虛線</strong>：支撐（綠）同阻力（紅）
          </li>
        </ul>
        <p>
          範圍大約近 6 個月日線。可以左右拖動睇。若 MA20 上穿 MA50，常被視為短中線轉強訊號之一（仍要配合整體分數）。
        </p>
      </article>

      <p id="extra" className="group-header">
        7. 財報 · 新聞 · 觀察期
      </p>
      <article className="learn-card">
        <h3>財報日期</h3>
        <p>
          公司公布業績前後，股價波動通常變大。ETF 多數冇「公司財報」。見到下次財報接近，宜更小心倉位同風險。
        </p>
        <h3>新聞</h3>
        <p>
          來自 Yahoo 相關新聞標題，方便快速了解最近發生咩事。新聞唔會直接改分數，但可以幫你理解突變。
        </p>
        <h3>建議觀察期</h3>
        <ul className="learn-list">
          <li>
            <strong>短線</strong>：常見約 3–10 個交易日
          </li>
          <li>
            <strong>長線</strong>：常見約 3–12 個月思維
          </li>
        </ul>
        <p>呢個係「建議你用咩時間框架去評估結果」，唔係保證喺呢段時間內一定賺。</p>
      </article>

      <p id="howto" className="group-header">
        8. 新手建議用法
      </p>
      <article className="learn-card">
        <ol className="learn-list numbered">
          <li>
            先去 <Link href="/short">短線</Link> 睇「偏多」名單，唔好一次過買晒。
          </li>
          <li>
            撳入詳情：睇圖、支撐距離、分數原因、財報係咪臨近。
          </li>
          <li>
            想長線配置，去 <Link href="/long">長線</Link> 睇 ETF／大趨勢。
          </li>
          <li>
            感興趣就加 ★ 入 <Link href="/watchlist">關注</Link>，之後追蹤。
          </li>
          <li>只用你負擔得起嘅錢；波動可以好大。</li>
        </ol>
        <p className="learn-tip">今晚贏鋪大,老婆仔女攞去賣!</p>
      </article>

      <p className="group-footer">
        想實戰對照：去 <Link href="/short">短線</Link> 揀一隻股，對住圖同本頁一齊睇。
      </p>
    </section>
  );
}
