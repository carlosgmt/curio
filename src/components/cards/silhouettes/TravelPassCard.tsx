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
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col flex-1">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[var(--gallery-hairline)]">
          <div className="flex items-center gap-2 min-w-0">
            {isTrain ? (
              <Train className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" aria-hidden="true" />
            ) : (
              <Plane className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" aria-hidden="true" />
            )}
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">
              {operator}
            </span>
          </div>

          {(status || code) && (
            <span className="text-[11px] font-mono tabular-nums text-[var(--brand)] shrink-0">
              {[code, status].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>

        {/* Route Hero or Title */}
        {origin && destination ? (
          <div className="flex items-center justify-between py-2 mb-3">
            <div className="flex flex-col">
              <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                {origin}
              </span>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Departure</span>
            </div>

            <div className="flex-1 mx-4 border-t border-dashed border-[var(--gallery-hairline)]" />

            <div className="flex flex-col items-end">
              <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                {destination}
              </span>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Arrival</span>
            </div>
          </div>
        ) : (
          <div className="py-1 mb-2">
            <h3 className="font-serif-editorial text-lg font-medium text-foreground leading-snug">
              {entity?.title || "Travel Pass"}
            </h3>
            {entity?.summary && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entity.summary}</p>
            )}
          </div>
        )}

        {/* Spec Information Matrix */}
        {infoCells.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[var(--gallery-hairline)]">
            {infoCells.map((cell) => (
              <div key={cell.label} className="flex flex-col">
                <span className="text-[9px] font-mono uppercase text-muted-foreground">
                  {cell.label}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums truncate ${
                    cell.accent ? "text-[var(--brand)] font-medium" : "text-foreground"
                  }`}
                >
                  {cell.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {bookingRef && (
          <p className="mt-3 pt-2 border-t border-[var(--gallery-hairline)] text-[11px] font-mono tabular-nums text-muted-foreground">
            Ref {bookingRef}
          </p>
        )}
      </div>

      {/* Hover/Focus-Revealed Footer */}
      {entity && (
        <div className="curio-hover-footer">
          <CardFooterWaterfall
            entity={entity}
            primarySource={primarySource}
            creatorAffiliateTags={creatorAffiliateTags}
            isWishlist={Boolean(save.wishlist)}
          />
        </div>
      )}
    </div>
  );
}
