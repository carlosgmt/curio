"use client";

import React, { useEffect, useRef } from "react";
import { Lock, ShieldCheck, X } from "lucide-react";
import { MCP_DOMAIN_DEFS, type McpDomainId, type McpScopeMap } from "@/lib/mcp/scopeDefs";

export interface McpVaultSheetProps {
  isOpen: boolean;
  scopes: McpScopeMap;
  saving?: boolean;
  onToggleDomain: (domainId: McpDomainId, nextValue: boolean) => void;
  onClose: () => void;
}

/**
 * Obsidian (#121110) Modular MCP Vault Sheet:
 * Uses native <dialog> showModal() with Prussian/Archival Cobalt (#6B93F5) open toggles
 * and muted stone sealed states so the owner controls exactly which life domains agents can read.
 */
export function McpVaultSheet({
  isOpen,
  scopes,
  saving = false,
  onToggleDomain,
  onClose,
}: McpVaultSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedOutsideRef = useRef(false);

  const isPointerOutside = (
    e: React.PointerEvent<HTMLDialogElement>,
    dialog: HTMLDialogElement
  ) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
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

  const openCount = MCP_DOMAIN_DEFS.filter((d) => scopes[d.id]).length;

  return (
    <dialog
      ref={dialogRef}
      data-testid="mcp-vault-sheet"
      aria-labelledby="mcp-vault-title"
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
      className="mt-auto mb-0 sm:my-auto mx-auto w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-[#121110] text-[#F2EFE9] border border-white/10 p-0 shadow-2xl backdrop:bg-black/65"
    >
      <div className="px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <h2
            id="mcp-vault-title"
            className="font-serif-editorial text-xl font-normal text-[#F2EFE9]"
          >
            Modular MCP Vault
          </h2>
          <p className="text-[11px] font-mono text-[#A8A196] mt-0.5 tabular-nums">
            {openCount} of {MCP_DOMAIN_DEFS.length} domains open to local MCP agents
          </p>
        </div>

        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close Modular MCP Vault"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-[#A8A196] hover:text-[#F2EFE9] hover:bg-white/10 transition cursor-pointer"
        >
          <span>Done</span>
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 space-y-2.5 max-h-[70dvh] overflow-y-auto overscroll-contain">
        {MCP_DOMAIN_DEFS.map((domain) => {
          const isOpenScope = Boolean(scopes[domain.id]);
          return (
            <button
              key={domain.id}
              type="button"
              data-testid={`mcp-scope-toggle-${domain.id}`}
              aria-pressed={isOpenScope}
              disabled={saving}
              onClick={() => onToggleDomain(domain.id, !isOpenScope)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors duration-150 cursor-pointer disabled:opacity-60 ${
                isOpenScope
                  ? "border-[#6B93F5]/45 bg-[#6B93F5]/10"
                  : "border-white/10 bg-[#1C1A17] hover:border-white/20"
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#F2EFE9]">
                  {domain.label}
                </div>
                <div className="text-xs text-[#A8A196] mt-0.5">
                  {domain.description}
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] shrink-0 border ${
                  isOpenScope
                    ? "border-[#6B93F5]/55 bg-[#6B93F5]/15 text-[#9CB9F9]"
                    : "border-white/15 bg-black/30 text-[#A8A196]"
                }`}
              >
                {isOpenScope ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-[#6B93F5]" aria-hidden="true" />
                    <span>Open</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-[#A8A196]" aria-hidden="true" />
                    <span>Sealed</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3 text-[11px] font-mono text-[#A8A196] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <span>Prussian Cobalt marks live MCP agent visibility</span>
        <span className="text-[#F2EFE9]/80">Read-only · Local</span>
      </div>
    </dialog>
  );
}
