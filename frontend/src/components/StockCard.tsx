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
