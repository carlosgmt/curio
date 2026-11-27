"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface BoardFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Native <dialog> bottom sheet for mobile board filters, sort, and sync actions.
 * Uses showModal() + close() with pointer-bounds light-dismiss fallback (no role="dialog" or body scroll lock).
 */
export function BoardFilterSheet({
  isOpen,
  onClose,
  title = "Filter & Tools",
  subtitle,
  children,
}: BoardFilterSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedOutsideRef = useRef(false);

  const isPointerOutside = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
    const rect = dialog.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      data-testid="board-filter-sheet"
      aria-labelledby="board-filter-sheet-title"
      onClose={onClose}
      onPointerDown={(e) => {
        const dialog = dialogRef.current;
        pressedOutsideRef.current = Boolean(
          dialog && e.target === dialog && isPointerOutside(e, dialog)
        );
      }}
      onPointerUp={(e) => {
        const dialog = dialogRef.current;
        if (
          pressedOutsideRef.current &&
          dialog &&
          e.target === dialog &&
          isPointerOutside(e, dialog)
        ) {
          dialog.close();
        }
        pressedOutsideRef.current = false;
      }}
      className="mt-auto mb-0 sm:my-auto mx-auto w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card text-foreground border border-[var(--gallery-hairline)] p-0 shadow-[var(--shadow-float)] backdrop:bg-black/50"
    >
      <div className="px-5 pt-4 pb-3 border-b border-[var(--gallery-hairline)] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="board-filter-sheet-title"
            className="font-serif-editorial text-lg font-medium text-foreground truncate"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close filter sheet"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition cursor-pointer shrink-0"
        >
          <span>Done</span>
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 max-h-[75dvh] overflow-y-auto overscroll-contain space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </dialog>
  );
}
