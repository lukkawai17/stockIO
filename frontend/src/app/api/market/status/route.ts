import { NextResponse } from "next/server";
import { getUsMarketSession } from "@/lib/marketHours";

export const runtime = "nodejs";

export async function GET() {
  const info = getUsMarketSession();
  return NextResponse.json({
    is_open: info.is_open,
    session: info.session,
    session_label: info.session_label,
    poll_interval_ms: info.poll_interval_ms,
    server_time_utc: info.server_time_utc,
    et_clock: info.et_clock,
    note: info.note,
  });
}
