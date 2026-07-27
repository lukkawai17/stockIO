"use client";

import { useEffect, useRef } from "react";
import { fetchMarketStatus } from "@/lib/api";

type Options = {
  /** When false, polling is paused (e.g. missing tickers). */
  enabled?: boolean;
  /** Restart polling when this changes (e.g. ticker list). */
  watchKey?: string;
  openIntervalMs?: number;
  closedIntervalMs?: number;
  /**
   * When true (default), use poll_interval_ms from /api/market/status.
   * Set false for slower jobs (e.g. live scoring) that pass their own intervals.
   */
  useStatusInterval?: boolean;
  onStatus?: (info: {
    is_open: boolean;
    session: string;
    session_label?: string;
    poll_interval_ms?: number;
  }) => void;
};

/**
 * Poll `refresh` while the page is visible.
 * Faster during US regular hours; also fires on tab focus / visibility.
 */
export function useAutoRefresh(refresh: () => void | Promise<void>, opts: Options = {}) {
  const {
    enabled = true,
    watchKey = "",
    openIntervalMs = 45_000,
    closedIntervalMs = 5 * 60_000,
    useStatusInterval = true,
    onStatus,
  } = opts;

  const refreshRef = useRef(refresh);
  const onStatusRef = useRef(onStatus);

  useEffect(() => {
    refreshRef.current = refresh;
    onStatusRef.current = onStatus;
  }, [refresh, onStatus]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastOpen: boolean | null = null;

    const clear = () => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const run = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        await refreshRef.current();
      } catch {
        /* caller handles */
      }
    };

    const schedule = async () => {
      clear();
      if (cancelled) return;

      let interval = closedIntervalMs;
      try {
        const status = await fetchMarketStatus();
        if (cancelled) return;
        const open = !!status.is_open;
        const session = status.session || (open ? "regular" : "closed");
        onStatusRef.current?.({
          is_open: open,
          session,
          session_label: status.session_label,
          poll_interval_ms: status.poll_interval_ms,
        });

        if (useStatusInterval && typeof status.poll_interval_ms === "number" && status.poll_interval_ms > 0) {
          interval = status.poll_interval_ms;
        } else if (session === "regular") {
          interval = openIntervalMs;
        } else if (session === "pre" || session === "post") {
          interval = Math.max(openIntervalMs, 90_000);
        } else {
          interval = closedIntervalMs;
        }

        if (lastOpen === false && open) {
          await run();
        }
        lastOpen = open;
      } catch {
        interval = closedIntervalMs;
      }

      timer = setTimeout(async () => {
        await run();
        schedule();
      }, interval);
    };

    (async () => {
      await run();
      if (!cancelled) schedule();
    })();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        run();
        schedule();
      }
    };
    const onFocus = () => {
      run();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, watchKey, openIntervalMs, closedIntervalMs, useStatusInterval]);
}
