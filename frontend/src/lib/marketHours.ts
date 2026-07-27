/** US equity session helpers (America/New_York). */

export type MarketSessionInfo = {
  is_open: boolean;
  /** regular | pre | post | closed */
  session: "regular" | "pre" | "post" | "closed";
  session_label: string;
  /** Suggested client poll interval in ms */
  poll_interval_ms: number;
  note: string;
  server_time_utc: string;
  et_clock: string;
};

const ET = "America/New_York";

function etParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const weekday = parts.weekday; // Mon, Tue, ...
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  const minute = Number(parts.minute);
  return {
    weekday,
    minutes: hour * 60 + minute,
    clock: `${parts.year}-${parts.month}-${parts.day} ${String(hour).padStart(2, "0")}:${parts.minute} ET`,
  };
}

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

/** Regular: 09:30–16:00 ET; pre 04:00–09:30; post 16:00–20:00 (approx Yahoo extended). */
export function getUsMarketSession(now = new Date()): MarketSessionInfo {
  const { weekday, minutes, clock } = etParts(now);
  const isWeekday = WEEKDAYS.has(weekday);
  const preOpen = 4 * 60;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  const postClose = 20 * 60;

  let session: MarketSessionInfo["session"] = "closed";
  if (isWeekday) {
    if (minutes >= open && minutes < close) session = "regular";
    else if (minutes >= preOpen && minutes < open) session = "pre";
    else if (minutes >= close && minutes < postClose) session = "post";
  }

  const is_open = session === "regular";
  const poll_interval_ms =
    session === "regular" ? 45_000 : session === "pre" || session === "post" ? 90_000 : 5 * 60_000;

  const session_label =
    session === "regular"
      ? "開市中"
      : session === "pre"
        ? "盤前"
        : session === "post"
          ? "盤後"
          : "已收市";

  return {
    is_open,
    session,
    session_label,
    poll_interval_ms,
    note: "美東交易時段約 09:30–16:00（含夏令／冬令自動轉換）",
    server_time_utc: now.toISOString(),
    et_clock: clock,
  };
}
