# stockIO

美股市場掃描 PWA：短線技術建議 + 長線/ETF 趨勢，支援關注清單、支撐阻力、財報日期同新聞。

> 只供學習同朋友參考，**唔係投資建議**。數據來自 Yahoo Finance（`yfinance`，非官方 API）。

## 功能

- 掃描 S&P / Nasdaq 高流通股 + 主要 ETF
- 短線頁：MA / RSI / MACD / 成交量 / 支撐阻力 → 買 / 持有 / 避開 + 分數 + 原因 + 建議觀察期
- 長線頁：50/200 日趨勢、相對 SPY 強弱
- 股票詳情：支撐阻力、財報、新聞
- Watchlist（本機 localStorage，可匯出/匯入）
- PWA（iPhone Safari → 分享 → 加入主畫面）
- 開市期間約每 3 分鐘刷新榜上報價；分數快取約 3 小時（一日可重計數次）

## 結構

```
stockIO/
  backend/     FastAPI + yfinance
  frontend/    Next.js PWA
```

## 本地啟動

### 1) 後端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

第一次啟動會喺背景預熱掃描（可能 1–3 分鐘）。API 文件：http://127.0.0.1:8000/docs

### 2) 前端

```bash
cd frontend
npm install
npm run dev
```

打開 http://localhost:3000

前端會透過 Next rewrite 將 `/api/*` 轉去 `http://127.0.0.1:8000`。

## iPhone 當 App

1. 用同一個 Wi-Fi，瀏覽器打開你電腦嘅區網 IP（例如 `http://192.168.x.x:3000`），或者之後部署上 Vercel
2. Safari → 分享 → **加入主畫面**

## 免費上線（朋友喺外地都開到）

詳見下面「部署步驟」。概念：

1. 程式推上 **GitHub**
2. **Render** 跑後端 → 得到 `https://xxxx.onrender.com`
3. **Vercel** 跑前端 → 得到 `https://xxxx.vercel.app`
4. 前端環境變數 `BACKEND_URL` = Render 網址

### 部署步驟

#### A. 推上 GitHub

1. 去 https://github.com/new 開一個新 repo（例如 `stockIO`，Private 都得）
2. 喺電腦終端執行（把 `YOUR_USER` 改做你嘅 GitHub 名）：

```bash
cd /Users/ka/stockIO
git add .
git commit -m "Initial stockIO app ready for deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USER/stockIO.git
git push -u origin main
```

#### B. 後端 → Render（免費）

1. 去 https://render.com 用 GitHub 登入
2. **New → Web Service** → 選 `stockIO` repo
3. 設定：
   - **Root Directory:** `backend`
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance type:** Free
4. Create Web Service，等佢 Deploy 完
5. 複製網址，例如 `https://stockio-api.onrender.com`
6. 瀏覽器開 `https://你的後端.onrender.com/api/health`，應該見到 `{"ok":true,...}`

> Free plan 冇人用大約 15 分鐘會瞓著，朋友第一次開可能要等 30–60 秒先醒。

#### C. 前端 → Vercel（免費）

1. 去 https://vercel.com 用 GitHub 登入
2. **Add New → Project** → 匯入 `stockIO`
3. 設定：
   - **Root Directory:** `frontend`（點 Edit 改）
   - **Framework:** Next.js（自動）
4. **Environment Variables** 加：
   - Name: `BACKEND_URL`
   - Value: `https://你的後端.onrender.com`（唔好最後加 `/`）
5. Deploy
6. 完成後會有 `https://xxxx.vercel.app` → **呢個就係傳俾朋友嘅網址**

#### D. （建議）返去 Render 加 CORS

Render → 你嘅服務 → Environment → Add：

- Key: `FRONTEND_ORIGIN`
- Value: `https://xxxx.vercel.app`

然後 Manual Deploy 一次。

#### E. 傳俾朋友

> 用手機 Safari 開：https://xxxx.vercel.app  
> 分享 → 加入主畫面，就可以當 App 用。

### 更新網站

之後改完 code：

```bash
git add .
git commit -m "update something"
git push
```

Vercel / Render 通常會自動重新部署。

## API 重點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/scan/short` | 短線掃描結果 |
| GET | `/api/scan/long` | 長線掃描結果 |
| POST | `/api/scan/{mode}/refresh` | 背景重新計分 |
| GET | `/api/quotes?symbols=AAPL,NVDA` | 報價 |
| GET | `/api/stock/AAPL` | 詳情（技術+財報+新聞） |
