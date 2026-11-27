"use client";

import React from "react";
import { Cpu, Zap, BatteryCharging, Radio, Usb } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

const MAX_PORT_PILLS = 3;

export function ElectronicsCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const ext = (typeof entity.extendedAttributes === "object" && entity.extendedAttributes) || {};
  const brand = entity.brandOrCreator || data.brand || ext.brand || "Hardware";
  const deviceName = entity.title;

  const chipArchitecture = data.chip || data.architecture || data.dac || null;
  const batteryHours = data.batteryHours || data.batteryLife || null;
  const wattage = data.wattage || null;
  const ports: string[] = Array.isArray(data.ports) ? data.ports.filter(Boolean) : [];
  const connectivity = data.connectivity || null;

  const modelNumber = data.modelNumber || ext.modelNumber || data.model || null;
  const retailer =
    typeof data.retailer === "string" && data.retailer.trim()
      ? data.retailer.trim()
      : typeof ext.retailers === "string" && ext.retailers.trim()
      ? ext.retailers.trim()
      : null;
  const warrantyUntil = data.warrantyUntil || ext.warrantyUntil || null;

  const priceCents = primarySource?.priceCents ?? entity.priceCents;
  const currency = primarySource?.currency || entity.currency || "CHF";
  const formattedPrice =
    typeof priceCents === "number" && priceCents > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency || "CHF",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(priceCents / 100)
      : null;

  const visiblePorts = ports.slice(0, MAX_PORT_PILLS);
  const overflowPorts = Math.max(0, ports.length - visiblePorts.length);
  const ownershipMeta = [
    modelNumber ? `Model ${modelNumber}` : null,
    retailer,
    warrantyUntil ? `Warranty ${warrantyUntil}` : null,
  ].filter(Boolean);

  return (
    <div
      data-testid="electronics-card"
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        {/* Hero Device Media */}
        {entity.heroImageUrl ? (
          <div className="relative aspect-[16/10] w-full rounded-[8px] overflow-hidden bg-[var(--well-surface)] mb-3">
            <img
              src={entity.heroImageUrl}
              alt={deviceName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="w-full aspect-[16/10] rounded-[8px] bg-[var(--well-surface)] flex items-center justify-center text-muted-foreground mb-3">
            <Radio className="w-8 h-8 stroke-1" aria-hidden="true" />
          </div>
        )}

        {/* Device Name & Single Price */}
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm sm:text-[15px] font-medium text-foreground leading-snug line-clamp-2">
            {deviceName}
          </h3>
          {formattedPrice && (
            <span className="text-xs font-mono tabular-nums font-medium text-[var(--brand)] shrink-0">
              {formattedPrice}
            </span>
          )}
        </div>

        {/* Real Hardware & Ownership Line */}
        {(brand || chipArchitecture || ownershipMeta.length > 0) && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[brand, chipArchitecture, ...ownershipMeta].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Telemetry Spec Grid (only when real wattage or battery data exists) */}
        {(wattage || batteryHours) && (
          <div
            data-testid="electronics-telemetry"
            className="grid grid-cols-2 gap-2 pt-2 mt-2 border-t border-[var(--gallery-hairline)] text-[10px] font-mono tabular-nums"
          >
            {wattage && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="w-3 h-3 text-[var(--brand)] shrink-0" aria-hidden="true" />
                <span className="text-foreground">{wattage}</span>
              </div>
            )}

            {batteryHours && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <BatteryCharging className="w-3 h-3 text-[var(--brand)] shrink-0" aria-hidden="true" />
                <span className="text-foreground">{batteryHours}</span>
              </div>
            )}
          </div>
        )}

        {/* Ports & Connectivity (capped to 3 + N) */}
        {(visiblePorts.length > 0 || connectivity) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[10px] font-mono text-muted-foreground">
            <Usb className="w-3 h-3 shrink-0" aria-hidden="true" />
            {visiblePorts.map((port, idx) => (
              <span
                key={idx}
                data-testid={`port-${idx}`}
                className="px-1.5 py-0.5 rounded bg-[var(--well-surface)] border border-[var(--gallery-hairline)] text-foreground/85"
              >
                {port}
              </span>
            ))}
            {overflowPorts > 0 && <span className="tabular-nums">+{overflowPorts}</span>}
            {connectivity && <span>{connectivity}</span>}
          </div>
        )}

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={onSwapped}
        />
      </div>

      {/* Hover/Focus-Revealed Footer Waterfall */}
      <div className="curio-hover-footer">
        <CardFooterWaterfall
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          isWishlist={Boolean(save.wishlist)}
          hidePrice
        />
      </div>
    </div>
  );
}
