"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ArrowDown } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 110;

export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
  /** Disable while a modal is open. */
  disabled?: boolean;
}

/**
 * Touch-only pull-to-refresh for the main feed. Only engages when the window is scrolled
 * to the top, the gesture starts outside horizontal scrollers/modals, and the drag is vertical.
 */
export function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const active = useRef(false);
  const pullRef = useRef(0);

  const finish = useCallback(async () => {
    if (pullRef.current >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD * 0.7);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    pullRef.current = 0;
    setPull(0);
  }, [onRefresh]);

  useEffect(() => {
    if (disabled) return;

    const canStart = (target: EventTarget | null) => {
      if (window.scrollY > 0) return false;
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.dataset?.lightboxModal || el.closest?.("[data-lightbox-modal]")) return false;
        const style = getComputedStyle(el);
        const scrollableX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
        const scrollableY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
        if (scrollableX || scrollableY) return false;
        el = el.parentElement;
      }
      return true;
    };

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1) return;
      if (!canStart(e.target)) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      active.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;
      if (!active.current) {
        if (Math.abs(dx) > Math.abs(dy) || dy < 8) {
          if (dy < -4 || Math.abs(dx) > 10) startY.current = null;
          return;
        }
        active.current = true;
      }
      if (window.scrollY > 0) {
        startY.current = null;
        active.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const damped = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = damped;
      setPull(damped);
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (active.current) {
        active.current = false;
        void finish();
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled, refreshing, finish]);

  const ready = pull >= THRESHOLD;

  return (
    <div className="relative overscroll-y-contain">
      <div
        aria-hidden={pull === 0 && !refreshing}
        data-testid="ptr-indicator"
        className="pointer-events-none flex justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: pull }}
      >
        <div className="mt-2 w-8 h-8 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md flex items-center justify-center">
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin text-neutral-600 dark:text-neutral-300" />
          ) : (
            <ArrowDown
              className={`w-4 h-4 text-neutral-500 transition-transform ${ready ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
