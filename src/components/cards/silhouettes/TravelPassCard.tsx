"use client";

import React from "react";
import { Plane, Train, Ticket, Clock, Calendar, ArrowRight, ExternalLink } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function TravelPassCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
}: SilhouetteCardProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const isTrain = data.mode === "train" || entity?.title?.toLowerCase().includes("train") || entity?.title?.toLowerCase().includes("ave");

  const operator = data.operator || entity?.brandOrCreator || (isTrain ? "High-Speed Rail" : "Airlines");
  const code = data.code || entity?.title?.split(":")[0] || "PASS 01";
  const origin = data.origin || "MAD";
  const destination = data.destination || "BCN";
  const departureTime = data.departureTime || "08:30";
  const arrivalTime = data.arrivalTime || "10:15";
  const date = data.date || "2026-10-24";
  const seat = data.seat || "12A";
  const gate = data.gate || "B22";
  const terminal = data.terminal || "T4";
  const bookingRef = data.bookingRef || "CR789K";
  const status = data.status || "ON TIME";

  return (
    <div
      data-testid="travel-pass-card"
      className="group relative rounded-2xl bg-neutral-900 text-white shadow-md hover:shadow-xl transition-all duration-300 border border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Pass Stub */}
      <div className="p-5 flex flex-col">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
              {isTrain ? <Train className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
            </div>
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-neutral-300">
              {operator}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-semibold tracking-wider">
              {status}
            </span>
            <span className="text-xs font-mono font-bold text-neutral-400">{code}</span>
          </div>
        </div>

        {/* Airport/Station Route Hero Display */}
        <div className="flex items-center justify-between py-2 mb-3">
          <div className="flex flex-col">
            <span className="font-mono text-3xl font-black tracking-tight text-white">{origin}</span>
            <span className="text-[10px] font-mono uppercase text-neutral-400">Departure</span>
          </div>

          <div className="flex-1 flex flex-col items-center px-4">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              {isTrain ? <Train className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
            </div>
            <div className="w-full border-t border-dashed border-neutral-700 relative">
              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-neutral-800" />
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="font-mono text-3xl font-black tracking-tight text-white">{destination}</span>
            <span className="text-[10px] font-mono uppercase text-neutral-400">Arrival</span>
          </div>
        </div>

        {/* Boarding Pass Perforation Cutouts */}
        <div className="relative my-3 -mx-5 flex items-center justify-between">
          <div className="w-4 h-6 rounded-r-full bg-[#fbf9f6] dark:bg-stone-950" />
          <div className="flex-1 border-b-2 border-dashed border-neutral-800 mx-2" />
          <div className="w-4 h-6 rounded-l-full bg-[#fbf9f6] dark:bg-stone-950" />
        </div>

        {/* Spec Information Matrix */}
        <div className="grid grid-cols-4 gap-2 pt-1 mb-4 text-left">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase text-neutral-500 font-semibold">Date</span>
            <span className="text-xs font-mono font-bold text-neutral-200 truncate">{date}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase text-neutral-500 font-semibold">Departs</span>
            <span className="text-xs font-mono font-bold text-amber-400">{departureTime}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase text-neutral-500 font-semibold">Seat</span>
            <span className="text-xs font-mono font-bold text-white">{seat}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase text-neutral-500 font-semibold">Gate</span>
            <span className="text-xs font-mono font-bold text-white">{gate}</span>
          </div>
        </div>

        {/* Barcode Mock Visual */}
        <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-0.5 h-7">
            {[4, 2, 6, 3, 5, 2, 7, 4, 2, 6, 3, 5, 4, 2, 6, 3, 8, 2, 4, 3, 5, 2, 6].map((w, i) => (
              <span
                key={i}
                className="bg-neutral-400 rounded-2xs inline-block h-full"
                style={{ width: `${(w % 3) + 1.5}px` }}
              />
            ))}
          </div>
          <div className="text-right">
            <span className="text-[9px] font-mono text-neutral-500 block uppercase">Booking Ref</span>
            <span className="text-xs font-mono font-bold tracking-widest text-neutral-300">{bookingRef}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      {entity && (
        <CardFooterWaterfall
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
        />
      )}
    </div>
  );
}
