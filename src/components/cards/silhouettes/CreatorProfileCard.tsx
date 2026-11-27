"use client";

import React from "react";
import { User, Sparkles, BookOpen, Film, Music, Palette, ExternalLink, Calendar } from "lucide-react";
import { CardFooterWaterfall } from "../CardFooterWaterfall";
import { DisambiguationBar } from "../DisambiguationBar";
import type { SilhouetteCardProps } from "./VinylDiscCard";

export function CreatorProfileCard({
  save,
  entity,
  primarySource,
  creatorAffiliateTags,
  onSwapped,
}: SilhouetteCardProps) {
  const data = (typeof entity?.coreStructuredData === "object" && entity.coreStructuredData) || {};
  const name = entity?.title || "Creator";
  const role = (data.role || entity?.brandOrCreator?.split(" ").pop() || "CREATOR").toUpperCase();
  const nationality = data.nationality || (entity?.brandOrCreator?.split(" ")[0] !== role ? entity?.brandOrCreator?.split(" ")[0] : null);
  const birthYear = data.birthYear;
  const deathYear = data.deathYear;
  const bio = entity?.summary || data.bio || "";
  const notableWorks: string[] = Array.isArray(data.notableWorks) ? data.notableWorks : [];

  const getRoleIcon = () => {
    switch (role) {
      case "AUTHOR":
        return <BookOpen className="w-3.5 h-3.5" />;
      case "DIRECTOR":
        return <Film className="w-3.5 h-3.5" />;
      case "MUSICIAN":
        return <Music className="w-3.5 h-3.5" />;
      case "ARTIST":
        return <Palette className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  const eraText = birthYear
    ? deathYear
      ? `${birthYear}–${deathYear}`
      : `b. ${birthYear}`
    : null;

  return (
    <div
      data-testid="creator-profile-card"
      className="curio-gallery-card group relative flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Portrait & Identity Block */}
        <div className="flex items-start gap-4 mb-3">
          {entity?.heroImageUrl ? (
            <div className="relative w-18 h-22 rounded-[8px] overflow-hidden bg-[var(--well-surface)] shrink-0">
              <img
                src={entity.heroImageUrl}
                alt={name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </div>
          ) : (
            <div className="w-18 h-22 rounded-[8px] bg-[var(--well-surface)] flex items-center justify-center shrink-0 text-muted-foreground">
              <User className="w-7 h-7 stroke-1" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-serif-editorial text-lg font-medium text-foreground leading-tight truncate">
              {name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {[role.toLowerCase(), nationality, eraText].filter(Boolean).join(" · ")}
            </p>
            {bio && (
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mt-2">
                {bio}
              </p>
            )}
          </div>
        </div>

        {/* Notable Works */}
        {notableWorks.length > 0 && (
          <div className="pt-2.5 border-t border-[var(--gallery-hairline)] flex flex-wrap gap-1.5">
            {notableWorks.slice(0, 4).map((work, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-[var(--well-surface)] text-muted-foreground text-[11px] font-serif italic"
              >
                {work}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Disambiguation Bar */}
      <DisambiguationBar
        saveId={save.id}
        candidates={save.candidateFallbacks || []}
        onSwapped={onSwapped}
      />

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
