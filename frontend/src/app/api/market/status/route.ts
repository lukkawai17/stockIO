import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const now = new Date();
  // Rough US Eastern = UTC-4 (EDT)
  const et = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const weekday = et.getUTCDay(); // 0 Sun
  const minutes = et.getUTCHours() * 60 + et.getUTCMinutes();
  const openM = 9 * 60 + 30;
  const closeM = 16 * 60;
  const isWeekday = weekday >= 1 && weekday <= 5;
  const isOpen = isWeekday && minutes >= openM && minutes < closeM;
  return NextResponse.json({
    is_open: isOpen,
    session: isOpen ? "open" : "closed",
    server_time_utc: now.toISOString(),
    note: "美東交易時段約 09:30–16:00（夏令約 UTC-4）",
  });
}
