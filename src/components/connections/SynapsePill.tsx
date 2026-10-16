"use client";

import React from "react";
import { Wine, Music, Sparkles, Shirt, Utensils, Link2, X } from "lucide-react";
import type { ConnectedItem, ConnectionType } from "@/lib/connections/service";

interface SynapsePillProps {
  connection: ConnectedItem;
  onUnlink?: (connectionId: string) => void;
  onClick?: (targetSaveId: string) => void;
}

export function getSynapseLabel(type: ConnectionType, title: string): { label: string; icon: React.ReactNode } {
  switch (type) {
    case "PAIRED_WITH":
      return {
        label: `Paired with ${title}`,
        icon: <Wine className="w-3 h-3 text-rose-500" />,
      };
    case "SOUNDTRACK_TO":
      return {
        label: `Soundtrack: ${title}`,
        icon: <Music className="w-3 h-3 text-indigo-400" />,
      };
    case "INSPIRED_BY":
      return {
        label: `Inspired by ${title}`,
        icon: <Sparkles className="w-3 h-3 text-amber-400" />,
      };
    case "WORN_ON":
      return {
        label: `Worn on: ${title}`,
        icon: <Shirt className="w-3 h-3 text-blue-400" />,
      };
    case "CONSUMED_AT":
      return {
        label: `Consumed at ${title}`,
        icon: <Utensils className="w-3 h-3 text-emerald-400" />,
      };
    default:
      return {
        label: `Linked: ${title}`,
        icon: <Link2 className="w-3 h-3 text-neutral-400" />,
      };
  }
}

export function SynapsePill({ connection, onUnlink, onClick }: SynapsePillProps) {
  const { label, icon } = getSynapseLabel(connection.connectionType, connection.title);

  return (
    <div className="group/pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100/90 dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700/80 shadow-2xs transition hover:border-neutral-400 dark:hover:border-neutral-500 max-w-full">
      <div
        className="flex items-center gap-1.5 cursor-pointer truncate"
        onClick={() => onClick?.(connection.saveId)}
        title={connection.contextNote ? `${label} (${connection.contextNote})` : label}
      >
        {icon}
        <span className="truncate max-w-[200px]">{label}</span>
      </div>

      {onUnlink && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnlink(connection.connectionId);
          }}
          className="opacity-0 group-hover/pill:opacity-100 text-neutral-400 hover:text-rose-500 rounded-full p-0.5 transition cursor-pointer"
          title="Unlink connection"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}
