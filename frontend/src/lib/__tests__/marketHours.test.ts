import { describe, expect, it } from "vitest";
import { getUsMarketSession } from "@/lib/marketHours";

describe("getUsMarketSession", () => {
  it("marks weekday 10:00 ET as regular open", () => {
    // 2026-07-27 14:00 UTC = 10:00 EDT
    const info = getUsMarketSession(new Date("2026-07-27T14:00:00Z"));
    expect(info.is_open).toBe(true);
    expect(info.session).toBe("regular");
    expect(info.poll_interval_ms).toBe(45_000);
  });

  it("marks weekday 08:00 ET as pre-market", () => {
    // 2026-07-27 12:00 UTC = 08:00 EDT
    const info = getUsMarketSession(new Date("2026-07-27T12:00:00Z"));
    expect(info.is_open).toBe(false);
    expect(info.session).toBe("pre");
    expect(info.poll_interval_ms).toBe(90_000);
  });

  it("marks weekend as closed with slow poll", () => {
    // 2026-07-25 Saturday 15:00 UTC = 11:00 EDT
    const info = getUsMarketSession(new Date("2026-07-25T15:00:00Z"));
    expect(info.is_open).toBe(false);
    expect(info.session).toBe("closed");
    expect(info.poll_interval_ms).toBe(5 * 60_000);
  });
});
