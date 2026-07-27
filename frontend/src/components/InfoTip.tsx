"use client";

import type { ReactNode } from "react";

type Props = {
  /** Short label shown on the trigger (e.g. MA20). */
  label: string;
  children: ReactNode;
};

/**
 * Keyboard-accessible explanation: native <details>/<summary> is focusable
 * and operable with Enter/Space; no hover-only tooltip.
 */
export function InfoTip({ label, children }: Props) {
  return (
    <details className="info-tip">
      <summary className="info-tip-summary">
        <span>{label}</span>
        <span className="info-tip-icon" aria-hidden="true">
          ?
        </span>
        <span className="sr-only">（按 Enter 展開說明）</span>
      </summary>
      <div className="info-tip-panel" role="note">
        {children}
      </div>
    </details>
  );
}
