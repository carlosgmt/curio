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
      className="group relative rounded-2xl bg-neutral-950 text-neutral-100 shadow-sm hover:shadow-xl transition-shadow duration-200 border border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Header: Brand & Optional Chip / Model */}
        <div className="flex items-center justify-between gap-2 mb-2.5 pr-16 sm:pr-0">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 truncate">
            {brand}
          </span>
          {chipArchitecture ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-cyan-400 shrink-0">
              <Cpu className="w-3 h-3 text-cyan-400" aria-hidden="true" />
              <span className="truncate max-w-[130px]">{chipArchitecture}</span>
            </div>
          ) : modelNumber ? (
            <span className="text-[11px] font-mono tabular-nums text-neutral-400 truncate max-w-[140px]">
              {modelNumber}
            </span>
          ) : null}
        </div>

        {/* Hero Device Media */}
        {entity.heroImageUrl ? (
          <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-neutral-900 mb-3 border border-neutral-800/80">
            <img
              src={entity.heroImageUrl}
              alt={deviceName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="w-full aspect-16/9 rounded-xl bg-neutral-900 flex items-center justify-center text-neutral-600 mb-3 border border-neutral-800">
            <Radio className="w-8 h-8 stroke-1 text-cyan-500/70" aria-hidden="true" />
          </div>
        )}

        {/* Device Name & Single Price */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-sans text-base font-bold text-neutral-100 leading-snug line-clamp-2">
            {deviceName}
          </h3>
          {formattedPrice && (
            <span className="text-xs font-mono tabular-nums font-semibold text-neutral-200 shrink-0 pt-0.5">
              {formattedPrice}
            </span>
          )}
        </div>

        {/* Real Purchase Hub / Hardware Metadata Strip */}
        {ownershipMeta.length > 0 && (
          <p className="text-[11px] font-mono tabular-nums text-neutral-400 mb-2 truncate">
            {ownershipMeta.join(" · ")}
          </p>
        )}

        {/* Telemetry Spec Grid (only when real wattage or battery data exists) */}
        {(wattage || batteryHours) && (
          <div
            data-testid="electronics-telemetry"
            className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 text-[10px] font-mono tabular-nums mb-2.5"
          >
            {wattage && (
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                <div>
                  <span className="text-neutral-500 block text-[9px] uppercase">Power</span>
                  <span className="font-semibold text-neutral-200">{wattage}</span>
                </div>
              </div>
            )}

            {batteryHours && (
              <div className="flex items-center gap-2">
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                <div>
                  <span className="text-neutral-500 block text-[9px] uppercase">Runtime</span>
                  <span className="font-semibold text-neutral-200">{batteryHours}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ports & Connectivity Badges (only when real data exists, capped to 3 + N) */}
        {(visiblePorts.length > 0 || connectivity) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Usb className="w-3 h-3 text-neutral-500 mr-0.5 shrink-0" aria-hidden="true" />
            {visiblePorts.map((port, idx) => (
              <span
                key={idx}
                data-testid={`port-${idx}`}
                className="px-2 py-0.5 rounded bg-neutral-800/70 text-neutral-300 text-[10px] font-mono border border-neutral-700/60"
              >
                {port}
              </span>
            ))}
            {overflowPorts > 0 && (
              <span className="text-[10px] font-mono tabular-nums text-neutral-400">
                +{overflowPorts}
              </span>
            )}
            {connectivity && (
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 text-[10px] font-mono">
                {connectivity}
              </span>
            )}
          </div>
        )}

        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={onSwapped}
        />
      </div>

      {/* Footer Waterfall */}
      <CardFooterWaterfall
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
        isWishlist={Boolean(save.wishlist)}
        hidePrice
        tone="dark"
      />
    </div>
  );
}
