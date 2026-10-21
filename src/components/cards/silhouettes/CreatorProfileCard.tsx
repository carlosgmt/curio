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
      className="group relative rounded-2xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm hover:shadow-lg transition-all duration-300 border border-stone-200 dark:border-stone-800 flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex flex-col">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-mono font-medium">
            {getRoleIcon()}
            <span>{role}</span>
          </div>

          {eraText && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-stone-400">
              <Calendar className="w-3 h-3" />
              <span>{eraText}</span>
            </span>
          )}
        </div>

        {/* Portrait & Identity Block */}
        <div className="flex items-start gap-4 mb-4">
          {entity?.heroImageUrl ? (
            <div className="relative w-20 h-24 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 shadow-xs border border-stone-200/60 dark:border-stone-700">
              <img
                src={entity.heroImageUrl}
                alt={name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          ) : (
            <div className="w-20 h-24 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0 border border-stone-200 dark:border-stone-700">
              <User className="w-8 h-8 text-stone-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100 leading-tight mb-1 truncate">
              {name}
            </h3>
            {nationality && (
              <p className="text-xs font-mono text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                {nationality}
              </p>
            )}
            <p className="text-xs font-serif text-stone-600 dark:text-stone-300 line-clamp-3 leading-relaxed">
              {bio}
            </p>
          </div>
        </div>

        {/* Notable Works Synaptic Chips */}
        {notableWorks.length > 0 && (
          <div className="space-y-1.5 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block font-semibold">
              Key Works:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {notableWorks.map((work, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-serif italic"
                >
                  {work}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Disambiguation Bar */}
      <DisambiguationBar
          saveId={save.id}
          candidates={save.candidateFallbacks || []}
          onSwapped={onSwapped}
        />

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
