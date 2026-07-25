import type { Label } from "@/lib/types";

export function LabelBadge({ label }: { label: Label }) {
  const cls =
    label === "買" ? "badge buy" : label === "避開" ? "badge avoid" : "badge hold";
  return <span className={cls}>{label}</span>;
}
