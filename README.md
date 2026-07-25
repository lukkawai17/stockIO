# stockIO

美股市場掃描 PWA：短線技術建議 + 長線/ETF 趨勢，支援關注清單、支撐阻力、財報日期同新聞。

> 只供學習同朋友參考，**唔係投資建議**。數據來自 Yahoo Finance（非官方）。

## 功能

- 掃描 S&P / Nasdaq 高流通股 + 主要 ETF
- 短線 / 長線建議：買 / 持有 / 避開 + 分數 + 原因 + 建議觀察期
- 詳情：支撐阻力、財報、新聞
- Watchlist（本機 localStorage，可匯出/匯入）
- PWA（iPhone Safari → 分享 → 加入主畫面）
- 報價約每 3 分鐘刷新；全市場分數由 GitHub Actions 每日自動更新數次

## 架構（免費、唔使信用卡）

| 部分 | 放邊 | 費用 |
|------|------|------|
| 網站 + API | **Vercel** | Hobby 免費，通常唔使卡 |
| 全市場掃描 | **GitHub Actions** 跑 Python | 免費 |
| 程式碼 | GitHub | 免費 |

唔再需要 Render / Railway。

```
stockIO/
  frontend/     Next.js PWA + API routes
  backend/      Python 掃描器（供 GitHub Actions / 本地用）
  .github/workflows/scan.yml
```

## 本地開發

只要前端就得：

```bash
cd frontend
npm install
npm run dev
```

打開 http://localhost:3000

（可選）本地跑 Python 掃描更新 `frontend/public/data/`：

```bash
cd backend
source .venv/bin/activate
SCAN_OUT_DIR=../frontend/public/data python -c "from app.services.scanner import run_scan; run_scan('short', True); run_scan('long', True)"
```

## 部署上線（朋友外地都開到）

### 1) 程式已在 GitHub

Repo：https://github.com/lukkawai17/stockIO

### 2) 部署 Vercel（唯一要做）

1. 去 https://vercel.com → 用 **GitHub** 登入（Hobby，通常唔使信用卡）
2. **Add New → Project** → 匯入 `stockIO`
3. 設定：
   - **Root Directory:** `frontend`
   - Framework：Next.js（自動）
   - **唔使**加 `BACKEND_URL`
4. Deploy
5. 得到網址：`https://xxxx.vercel.app` → 傳俾朋友

### 3) 打開自動掃描

1. 去 https://github.com/lukkawai17/stockIO/actions
2. 左側揀 **Market Scan**
3. **Run workflow** 撳一次（之後會按時間表自動跑）
4. 跑完會 commit 更新 `frontend/public/data/*.json`，Vercel 會自動 redeploy

### 4) 傳俾朋友

> Safari 開：`https://xxxx.vercel.app`  
> 分享 → 加入主畫面

## iPhone

Safari 打開網站 → 分享 → **加入主畫面**。

## 注意

- GitHub Actions 免費額度對個人 repo 通常夠用
- Yahoo 非官方接口偶有不穩
- 只供參考，唔係投資建議
