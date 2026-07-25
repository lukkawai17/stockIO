import { NextResponse } from "next/server";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/version";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "stockIO",
    mode: "vercel-only",
    version: APP_VERSION,
    label: APP_VERSION_LABEL,
  });
}
