"use client";

import Link from "next/link";
import { LabelBadge } from "./LabelBadge";
import type { StockRow } from "@/lib/types";
import type { CSSProperties } from "react";

type Props = {
  row: StockRow;
  watched?: boolean;
  onToggleWatch?: (ticker: string) => void;
  style?: CSSProperties;
};

export function StockCard({ row, watched, onToggleWatch, style }: Props) {
  const up = row.change_pct > 0;
  const down = row.change_pct < 0;
  const chgClass = up ? "chg up" : down ? "chg down" : "chg flat";

  return (
    <div className="stock-cell" style={style}>
      <Link href={`/stock/${row.ticker}`} className="stock-cell-left">
        <span className="stock-symbol">{row.ticker}</span>
        <div className="row-meta">
          <LabelBadge label={row.label} />
          <span className="score-chip">{row.score.toFixed(0)}</span>
          {onToggleWatch && (
            <button
              type="button"
              className={watched ? "star-btn on" : "star-btn"}
              aria-label={watched ? "移除關注" : "加入關注"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleWatch(row.ticker);
              }}
            >
              {watched ? "★" : "☆"}
            </button>
          )}
        </div>
        <p className="stock-reason">{row.reason}</p>
        {(row.buy_price != null || row.sell_price != null || row.levels) && (
          <p className="stock-levels">
            {row.buy_price != null || row.levels?.buy != null ? (
              <span className="up">
                限 ${(row.buy_price ?? row.levels?.buy)?.toFixed(2)}
              </span>
            ) : (
              <span>買 —</span>
            )}
            <span className="levels-sep">·</span>
            {(row.sell_price != null || row.levels?.sell != null) && (
              <span className="down">
                賣 ${(row.sell_price ?? row.levels?.sell)?.toFixed(2)}
              </span>
            )}
            {(row.levels?.risk_reward != null || row.stop_price != null) && (
              <>
                <span className="levels-sep">·</span>
                <span className="levels-rr">
                  {row.levels?.risk_reward != null
                    ? `R${row.levels.risk_reward.toFixed(1)}`
                    : row.stop_price != null
                      ? `止$${row.stop_price.toFixed(0)}`
                      : ""}
                </span>
              </>
            )}
          </p>
        )}
      </Link>
      <Link href={`/stock/${row.ticker}`} className="stock-cell-right">
        <span className="stock-price">${row.price.toFixed(2)}</span>
        <span className={chgClass}>
          {up ? "+" : ""}
          {row.change_pct.toFixed(2)}%
        </span>
      </Link>
    </div>
  );
}
