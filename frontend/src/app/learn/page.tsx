import Link from "next/link";
import { APP_VERSION_LABEL } from "@/lib/version";

export default function LearnPage() {
  return (
    <section>
      <h1 className="large-title">知識</h1>
      <p className="page-sub">
        {APP_VERSION_LABEL} · 目標唔係「保證賺錢」——冇系統做得到。目標係提高長期期望值：只喺確認齊備時出手、嚴控單筆風險、避開明顯弱勢。
      </p>

      <p className="group-header">目錄</p>
      <div className="inset-list learn-toc">
        <a className="news-row" href="#truth">
          <strong>0. 誠實前提</strong>
          <p className="meta">點樣先有機會長期賺</p>
        </a>
        <a className="news-row" href="#edge">
          <strong>1. 盈利流程（必讀）</strong>
          <p className="meta">進場條件 · 倉位 · 止蝕</p>
        </a>
        <a className="news-row" href="#framework">
          <strong>2. multi_pillar_v3 框架</strong>
          <p className="meta">確認門檻 + 機構柱</p>
        </a>
        <a className="news-row" href="#institutional">
          <strong>3. 機構動向（13F）</strong>
          <p className="meta">增持/減持點解有用、滯後幾耐</p>
        </a>
        <a className="news-row" href="#short">
          <strong>4. 短線五柱</strong>
          <p className="meta">趨勢·動量·量能·結構·風險</p>
        </a>
        <a className="news-row" href="#long">
          <strong>5. 長線柱</strong>
          <p className="meta">雙動能 · 質素 · 機構</p>
        </a>
        <a className="news-row" href="#sr">
          <strong>6. 支撐 / 阻力</strong>
          <p className="meta">風險錨點</p>
        </a>
        <a className="news-row" href="#checklist">
          <strong>7. 出手前檢查表</strong>
          <p className="meta">照做先出手</p>
        </a>
        <a className="news-row" href="#limits">
          <strong>8. 限制</strong>
          <p className="meta">可信度邊界</p>
        </a>
        <a className="news-row" href="#backtest">
          <strong>9. 策略回測</strong>
          <p className="meta">驗證規則，唔係揀股神器</p>
        </a>
      </div>

      <p id="truth" className="group-header">
        0. 誠實前提（先讀呢段）
      </p>
      <article className="learn-card">
        <p>
          冇任何 App、指標、機構數據可以保證你賺錢。市場有隨機性、有結構性轉變、有黑天鵝。stockIO
          做嘅係把公開數據整理成「較少犯錯」嘅決策流程。
        </p>
        <p>長期有機會賺，通常嚟自三樣（實證同實務共識）：</p>
        <ul className="learn-list">
          <li>
            <strong>正期望值流程</strong>：勝率唔一定高，但贏時贏得多、輸時輸得少（風險報酬比）。
          </li>
          <li>
            <strong>生存優先</strong>：永遠唔好一次爆倉；單筆風險細，先有樣本數讓優勢發揮。
          </li>
          <li>
            <strong>風格對路</strong>：趨勢/動量類策略喺趨勢市較好；震盪市要降低置信、減少出手。
          </li>
        </ul>
        <p className="learn-tip">
          如果你想「確保賺錢」——唯一接近嘅答案係：低成本指數長持 + 唔用槓桿 + 唔亂加倉。stockIO
          係主動工具，風險更高，要配紀律。
        </p>
      </article>

      <p id="edge" className="group-header">
        1. 盈利流程（比分數更重要）
      </p>
      <article className="learn-card">
        <h3>A. 只喺「確認齊備」出手</h3>
        <p>
          v3 起，「買」唔只睇總分：要跨柱確認（短線至少 3 柱偏強，且趨勢+動量達標；長線要絕對動能+相對動能達標）。分數高但確認不足會被降為「持有」——呢個係刻意設計，減少假買訊。
        </p>
        <h3>B. 倉位：單筆風險 ≤ 本金 2%</h3>
        <p>
          例：本金 $10,000，單筆最多輸 $200。若止蝕距離係買入價 4%，則倉位約 $200 ÷ 4% =
          $5,000（半倉上限視個人）。ATR 高嘅股票要更細倉。
        </p>
        <h3>C. 止蝕錨點</h3>
        <ul className="learn-list">
          <li>短線：跌破近期支撐（見圖綠虛線）或 ATR×1.5</li>
          <li>長線：有效跌破 MA200，或相對 SPY 持續轉弱 + 機構明顯減持</li>
        </ul>
        <h3>D. 建議買入／賣出價（安全邊際版）</h3>
        <p>
          舊邏輯成日把買入價設成現價＝追高。而家改用混搭：
        </p>
        <ul className="learn-list">
          <li>
            <strong>回調入場</strong>：趨勢確認後，等價回 MA／支撐／折讓區，唔追突破高位。
          </li>
          <li>
            <strong>折讓 vs 溢價</strong>：喺支撐→阻力區間下半（約 &lt;45%）先考慮買；上半／貼阻力＝等回調。
          </li>
          <li>
            <strong>ATR 止蝕</strong>：止蝕放支撐下再加波幅緩衝，避免太貼被洗。
          </li>
          <li>
            <strong>最少約 2:1 風險報酬</strong>：賣出目標至少約係「買入到止蝕」距離嘅兩倍。
          </li>
        </ul>
        <p>
          列表顯示「限 $xx」＝限價回調位，唔係叫你市價追。入場方式會標「等回調／限價回調／已喺折讓區」。
        </p>
        <h3>E. 出場邏輯（預先寫低）</h3>
        <ul className="learn-list">
          <li>止蝕觸發 → 走，唔好「再等下」</li>
          <li>目標區（建議賣出價 / 分數轉弱）→ 減倉或部分獲利</li>
          <li>財報前後：波幅放大，倉位減半或觀望</li>
        </ul>
        <p className="learn-tip">分數只係過濾器；真正決定賺蝕多數係倉位同止蝕有冇執行。</p>
      </article>

      <p id="framework" className="group-header">
        2. multi_pillar_v3 框架
      </p>
      <article className="learn-card">
        <h3>短線：五柱加權 + 確認門檻</h3>
        <div className="inset-list" style={{ margin: "10px 0 14px" }}>
          <div className="inset-row">
            <dt>趨勢 Trend 30%</dt>
            <dd>MA20/50/200、排列</dd>
          </div>
          <div className="inset-row">
            <dt>動量 Momentum 25%</dt>
            <dd>RSI、MACD、近況、52週高</dd>
          </div>
          <div className="inset-row">
            <dt>量能 Volume 20%</dt>
            <dd>放量上攻 / 下跌</dd>
          </div>
          <div className="inset-row">
            <dt>結構 Structure 15%</dt>
            <dd>距支撐 / 阻力</dd>
          </div>
          <div className="inset-row">
            <dt>風險 Risk 10%</dt>
            <dd>ATR、回撤</dd>
          </div>
        </div>
        <h3>長線：雙動能 + 質素 + 機構</h3>
        <ul className="learn-list">
          <li>
            <strong>絕對動能</strong>：價 vs MA200 / MA50
          </li>
          <li>
            <strong>相對動能</strong>：近月 vs SPY
          </li>
          <li>
            <strong>中期動量</strong>：近月 / 近季、唔好過熱
          </li>
          <li>
            <strong>質素/估值</strong>：ROE、利潤率、PE、槓桿
          </li>
          <li>
            <strong>機構資金流</strong>：頂級持倉加權增減 + 機構持股比例（詳情頁）
          </li>
        </ul>
        <p>
          買門檻：短線約 ≥70 且確認齊；長線約 ≥72 且雙動能達標。機構明顯流出時，長線「買」會被降級。
        </p>
      </article>

      <p id="institutional" className="group-header">
        3. 機構動向（13F）點用
      </p>
      <article className="learn-card">
        <h3>係咩？</h3>
        <p>
          美國大型機構每季向 SEC 申報 13F。Yahoo 提供機構持股%、機構數量、以及主要持倉嘅持股比例同季對季變化。stockIO
          用頂級持倉做加權增減，得出「資金流分數」。
        </p>
        <h3>點解可能有用？</h3>
        <p>
          機構增持唔等於明天會升，但持續增持 + 股價趨勢向上，較似「資金同趨勢同向」。大量減持 +
          跌破長線均線，就較似要防守。
        </p>
        <h3>最大限制（一定要知）</h3>
        <ul className="learn-list">
          <li>
            <strong>滯後</strong>：報告反映嘅係上季持倉，可能已過數週至數月。
          </li>
          <li>
            <strong>被動基金噪音</strong>：Vanguard / Blackrock 指數基金買賣可能係跟指數權重，唔一定係主動看好。
          </li>
          <li>
            <strong>唔係短線訊號</strong>：13F 唔應用來做日內或一週交易。
          </li>
        </ul>
        <p className="learn-tip">
          正確用法：長線確認柱之一。趨勢弱 + 機構減持 → 更應避開；趨勢強 + 機構增持 →
          提高置信（仍要管風險）。
        </p>
      </article>

      <p id="short" className="group-header">
        4. 短線每一柱
      </p>
      <article className="learn-card">
        <h3>趨勢</h3>
        <p>
          價企穩 MA20/MA50 偏多；多頭排列更乾淨。同時喺 MA200 之上＝順大趨勢，假突破機會較低（仍會發生）。
        </p>
        <h3>動量</h3>
        <p>RSI / MACD / 近況回報 / 距 52 週高。超買可以繼續升，所以要同趨勢一齊睇。</p>
        <h3>量能</h3>
        <p>放量上升較似真需求；放量下跌較似真拋壓。</p>
        <h3>結構</h3>
        <p>接近支撐＝較佳觀察位；貼阻力＝冲關失敗風險高。</p>
        <h3>風險</h3>
        <p>ATR 過高 → 倉位要細。近月回撤太深亦扣分。</p>
      </article>

      <p id="long" className="group-header">
        5. 長線每一柱
      </p>
      <article className="learn-card">
        <h3>絕對 / 相對動能</h3>
        <p>MA200 作牛熊參考；同 SPY 比近月表現睇資金偏好。雙動能精神：自己向上 + 強過基準。</p>
        <h3>質素 / 估值</h3>
        <p>ROE、利潤率偏高通常較穩；PE 極高要小心故事溢價；槓桿過高喺壓力期較痛。</p>
        <h3>機構</h3>
        <p>見上一節。詳情頁會顯示頂級機構名單同增減%，並計入長線分數。</p>
      </article>

      <p id="sr" className="group-header">
        6. 支撐 / 阻力（風險錨點）
      </p>
      <article className="learn-card">
        <p>
          支撐＝下跌較易停住嘅區域；阻力＝上升較易受阻嘅區域。stockIO 用近期高低 +
          樞軸估算。圖上綠虛線支撐、紅虛線阻力。
        </p>
        <ul className="learn-list">
          <li>偏多 + 近支撐：較佳試倉區（仍要預設止蝕）</li>
          <li>已大升 + 貼阻力：減倉或等回調</li>
          <li>止蝕可放支撐下；跌穿就走</li>
        </ul>
      </article>

      <p id="checklist" className="group-header">
        7. 出手前檢查表（照做）
      </p>
      <article className="learn-card">
        <ul className="learn-list">
          <li>□ 標籤係「買」，唔係分數高但被降級嘅「持有」</li>
          <li>□ 短線：趨勢+動量柱都偏強；長線：絕對+相對都偏強</li>
          <li>□ 長線已睇機構：冇明顯大減持（或你接受滯後風險）</li>
          <li>□ 已寫低止蝕價；單筆最大虧損 ≤ 本金 2%</li>
          <li>□ 未來 7 日內若有財報：倉位減半或暫緩</li>
          <li>□ 唔用借貸／槓桿放大呢個訊號</li>
          <li>□ 最多同時持有少數高確信倉，唔好散彈打鳥</li>
        </ul>
        <p className="learn-tip">以上有一項做唔到 → 今轉觀望。錯過機會嘅成本，通常低過硬上爆倉。</p>
      </article>

      <p id="limits" className="group-header">
        8. 可信度邊界
      </p>
      <article className="learn-card">
        <ul className="learn-list">
          <li>數據來自公開行情（Yahoo 非官方），可能延遲或不完整。</li>
          <li>13F 滯後；指數基金增減可能係被動再平衡。</li>
          <li>規則型分數 ≠ 預言；政策、財報、流動性危機可瞬間打破結構。</li>
          <li>回測係策略健康檢查，過去 ≠ 未來。</li>
          <li>最適合：學習框架 + 縮小名單 + 自己用紀律執行。</li>
        </ul>
        <p className="learn-tip">今晚贏鋪大,老婆仔女攞去賣!</p>
      </article>

      <p id="backtest" className="group-header">
        9. 策略回測
      </p>
      <article className="learn-card">
        <p>
          回測頁驗證「當規則標『買』之後，之後幾日平均點樣」——用嚟檢查框架健康度，
          <strong>唔用來</strong>因為某隻股歷史靚就今日必買。
        </p>
        <ul className="learn-list">
          <li>
            <strong>追價</strong>：訊號日收市確認後，下一交易日開市入場，持有 5／10／20 日
          </li>
          <li>
            <strong>限價</strong>：訊號後最多 5 日跌入買入區間先入場；觸止蝕／目標或到期出場
          </li>
          <li>
            <strong>vs SPY</strong>：同期大市作基準
          </li>
        </ul>
        <p>
          限制：訊號可重疊、未計費用／滑價、過去 ≠ 未來。詳情見 <Link href="/backtest">回測頁</Link>。
        </p>
      </article>

      <p className="group-footer">
        下一步：開一隻股詳情，對住五柱／機構表同本頁檢查表一齊用。 <Link href="/short">短線</Link> ·{" "}
        <Link href="/long">長線</Link> · <Link href="/backtest">回測</Link>。
      </p>
    </section>
  );
}
