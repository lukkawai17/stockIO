/** Accessible gain/loss: never colour alone — arrow + text + aria-label. */

type Props = {
  pct: number;
  className?: string;
};

export function PriceChange({ pct, className }: Props) {
  const up = pct > 0;
  const down = pct < 0;
  const dir = up ? "升" : down ? "跌" : "平";
  const arrow = up ? "▲" : down ? "▼" : "•";
  const chgClass = up ? "chg up" : down ? "chg down" : "chg flat";
  const cls = className ? `${chgClass} ${className}` : chgClass;

  return (
    <span className={cls} aria-label={`${dir} ${Math.abs(pct).toFixed(2)}%`}>
      <span aria-hidden="true">{arrow} </span>
      {up ? "+" : ""}
      {pct.toFixed(2)}%
      <span className="sr-only">（{dir}）</span>
    </span>
  );
}
