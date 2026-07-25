"use client";

import Link from "next/link";
import { LabelBadge } from "./LabelBadge";
import type { StockRow } from "@/lib/types";

type Props = {
  row: StockRow;
  watched?: boolean;
  onToggleWatch?: (ticker: string) => void;
};

export function StockCard({ row, watched, onToggleWatch }: Props) {
  const up = row.change_pct >= 0;
  return (
    <article className="stock-row">
      <div className="stock-main">
        <Link href={`/stock/${row.ticker}`} className="ticker">
          {row.ticker}
        </Link>
        <LabelBadge label={row.label} />
        <span className="score">分 {row.score.toFixed(0)}</span>
      </div>
      <div className="stock-price">
        <span>${row.price.toFixed(2)}</span>
        <span className={up ? "up" : "down"}>
          {up ? "+" : ""}
          {row.change_pct.toFixed(2)}%
        </span>
      </div>
      <p className="reason">{row.reason}</p>
      {row.hold_period && <p className="meta">建議觀察：{row.hold_period}</p>}
      <div className="row-actions">
        <Link href={`/stock/${row.ticker}`} className="text-btn">
         詳情
        </Link>
        {onToggleWatch && (
          <button type="button" className="text-btn" onClick={() => onToggleWatch(row.ticker)}>
            {watched ? "移除關注" : "加入關注"}
          </button>
        )}
      </div>
    </article>
  );
}
