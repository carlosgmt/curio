"use client";

import React from "react";
import { Cpu, Zap, BatteryCharging, Radio, Usb } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function ElectronicsCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const brand = entity.brandOrCreator || data.brand || "Hardware Lab";
  const deviceName = entity.title;
  const chipArchitecture = data.chip || data.architecture || data.dac || "Dual ESS ES9038Q2M";
  const batteryHours = data.batteryHours || data.batteryLife || "18h";
  const wattage = data.wattage || "65W GaN";
  const ports = data.ports || ["USB-C PD 3.0", "4.4mm Bal", "3.5mm SE"];
  const connectivity = data.connectivity || "Bluetooth 5.3 LDAC";

  return (
    <div
      data-testid="electronics-card"
      className="group relative rounded-2xl bg-neutral-950 text-neutral-100 shadow-sm hover:shadow-xl transition-all duration-300 border border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Header: Brand & Architecture Telemetry */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400">
            {brand}
          </span>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-cyan-400">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span className="truncate max-w-[130px]">{chipArchitecture}</span>
          </div>
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
            <Radio className="w-8 h-8 stroke-1 text-cyan-500/70" />
          </div>
        )}

        {/* Device Name */}
        <h3 className="font-sans text-base font-bold text-neutral-100 mb-2 leading-snug">
          {deviceName}
        </h3>

        {/* Telemetry Spec Grid */}
        <div
          data-testid="electronics-telemetry"
          className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 text-[10px] font-mono mb-3"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div>
              <span className="text-neutral-500 block text-[9px] uppercase">Power</span>
              <span className="font-semibold text-neutral-200">{wattage}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-neutral-500 block text-[9px] uppercase">Runtime</span>
              <span className="font-semibold text-neutral-200">{batteryHours}</span>
            </div>
          </div>
        </div>

        {/* Ports & Connectivity Badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Usb className="w-3 h-3 text-neutral-500 mr-0.5" />
          {ports.map((port: string, idx: number) => (
            <span
              key={idx}
              data-testid={`port-${idx}`}
              className="px-2 py-0.5 rounded bg-neutral-800/70 text-neutral-300 text-[10px] font-mono border border-neutral-700/60"
            >
              {port}
            </span>
          ))}
          <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 text-[10px] font-mono">
            {connectivity}
          </span>
        </div>
      </div>

      {/* Disambiguation Swapper Bar */}
      {save.candidateFallbacks && save.candidateFallbacks.length > 0 && (
        <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks}
          onSwapped={onSwapped}
        />
      )}

      {/* Footer Waterfall */}
      <CardFooterWaterfall
        entity={entity}
        primarySource={primarySource}
        creatorAffiliateTags={creatorAffiliateTags}
      />
    </div>
  );
}
