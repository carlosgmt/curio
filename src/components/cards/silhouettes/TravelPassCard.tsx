"use client";

import React from "react";
import { Plane, Train } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function TravelPassCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
}: SilhouetteCardProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const isTrain =
    data.mode === "train" ||
    entity?.title?.toLowerCase().includes("train") ||
    entity?.title?.toLowerCase().includes("ave");

  const operator =
    data.operator || entity?.brandOrCreator || (isTrain ? "Rail" : "Transit");
  const code = data.code || null;
  const origin = data.origin || null;
  const destination = data.destination || null;
  const departureTime = data.departureTime || null;
  const date = data.date || null;
  const seat = data.seat || null;
  const gate = data.gate || null;
  const bookingRef = data.bookingRef || null;
  const status = data.status || null;

  const infoCells = [
    date ? { label: "Date", value: date, accent: false } : null,
    departureTime ? { label: "Departs", value: departureTime, accent: true } : null,
    seat ? { label: "Seat", value: seat, accent: false } : null,
    gate ? { label: "Gate", value: gate, accent: false } : null,
  ].filter((c): c is { label: string; value: string; accent: boolean } => Boolean(c));

  return (
    <div
      data-testid="travel-pass-card"
      className="group relative rounded-2xl bg-neutral-900 text-white shadow-md hover:shadow-xl transition-shadow duration-200 border border-neutral-800 flex flex-col justify-between overflow-hidden"
    >
      {/* Top Pass Stub */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-neutral-800 pr-16 sm:pr-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              {isTrain ? (
                <Train className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Plane className="w-4 h-4" aria-hidden="true" />
              )}
            </div>
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-neutral-300 truncate">
              {operator}
            </span>
          </div>

          {(status || code) && (
            <div className="flex items-center gap-2 shrink-0">
              {status && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-semibold tracking-wider">
                  {status}
                </span>
              )}
              {code && <span className="text-xs font-mono font-bold text-neutral-400">{code}</span>}
            </div>
          )}
        </div>

        {/* Route Hero or Clean Title */}
        {origin && destination ? (
          <div className="flex items-center justify-between py-2 mb-3">
            <div className="flex flex-col">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-white">
                {origin}
              </span>
              <span className="text-[10px] font-mono uppercase text-neutral-400">Departure</span>
            </div>

            <div className="flex-1 flex flex-col items-center px-4">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                {isTrain ? (
                  <Train className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Plane className="w-4 h-4" aria-hidden="true" />
                )}
              </div>
              <div className="w-full border-t border-dashed border-neutral-700 relative">
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-neutral-800" />
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-white">
                {destination}
              </span>
              <span className="text-[10px] font-mono uppercase text-neutral-400">Arrival</span>
            </div>
          </div>
        ) : (
          <div className="py-1 mb-2">
            <h3 className="font-serif text-lg font-bold text-white leading-snug">
              {entity?.title || "Travel Pass"}
            </h3>
            {entity?.summary && (
              <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{entity.summary}</p>
            )}
          </div>
        )}

        {/* Spec Information Matrix (only when real fields exist) */}
        {infoCells.length > 0 && (
          <>
            <div className="relative my-2.5 -mx-4 sm:-mx-5 flex items-center justify-between">
              <div className="w-3.5 h-5 rounded-r-full bg-[#fafaf9] dark:bg-[#0c0a09]" />
              <div className="flex-1 border-b border-dashed border-neutral-800 mx-2" />
              <div className="w-3.5 h-5 rounded-l-full bg-[#fafaf9] dark:bg-[#0c0a09]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 mb-3 text-left">
              {infoCells.map((cell) => (
                <div key={cell.label} className="flex flex-col">
                  <span className="text-[9px] font-mono uppercase text-neutral-500 font-semibold">
                    {cell.label}
                  </span>
                  <span
                    className={`text-xs font-mono tabular-nums font-bold truncate ${
                      cell.accent ? "text-amber-400" : "text-neutral-200"
                    }`}
                  >
                    {cell.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Booking Reference (only when real bookingRef exists) */}
        {bookingRef && (
          <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-0.5 h-6">
              {[4, 2, 6, 3, 5, 2, 7, 4, 2, 6, 3, 5, 4, 2, 6, 3, 8, 2, 4, 3].map((w, i) => (
                <span
                  key={i}
                  className="bg-neutral-500 rounded-2xs inline-block h-full"
                  style={{ width: `${(w % 3) + 1.5}px` }}
                />
              ))}
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-neutral-500 block uppercase">
                Booking Ref
              </span>
              <span className="text-xs font-mono font-bold tracking-widest text-neutral-300">
                {bookingRef}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {entity && (
        <CardFooterWaterfall
          entity={entity}
          primarySource={primarySource}
          creatorAffiliateTags={creatorAffiliateTags}
          isWishlist={Boolean(save.wishlist)}
          tone="dark"
        />
      )}
    </div>
  );
}
