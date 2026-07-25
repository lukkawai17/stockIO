import { ScanBoard } from "@/components/ScanBoard";

export default function ShortPage() {
  return (
    <ScanBoard
      mode="short"
      title="短線掃描"
      subtitle="用 MA / RSI / MACD / 成交量 / 支撐阻力，篩選美股短線偏多同偏淡。建議觀察約 3–10 個交易日。"
    />
  );
}
