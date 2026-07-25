# stockIO releases

## Unreleased

- Strategy backtest page (`/backtest`): event-study of 「買」 signals (chase vs limit vs SPY), weekly GitHub Action.

## v1.0.0 — Baseline (2026-07-25)

First named release of the free US-stock PWA.

Includes:
- Short / long multi-pillar scoring (v3) with buy confirmation gates
- Institutional 13F ownership on stock detail
- Safer buy / sell / stop levels (pullback limits, discount zone, ~2:1 R:R)
- Watchlist, charts, support/resistance, earnings, news
- Knowledge guide (expectancy + risk process)
- Vercel frontend + GitHub Actions market scan
