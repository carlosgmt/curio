import { notFound } from "next/navigation";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Sparkles,
  MapPin,
  CheckSquare,
  Copy,
  ArrowLeft,
  Calendar,
  Share2,
} from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const card = db.select().from(cards).where(eq(cards.id, id)).get();
  if (!card) return { title: "Card Not Found" };

  const parsedData = JSON.parse(card.data || "{}");
  const image =
    parsedData.coverUrl ||
    parsedData.artworkUrl ||
    parsedData.posterUrl ||
    parsedData.ogImage;

  return {
    title: `${card.title} — BrainSpace`,
    description: card.rawText || card.title,
    openGraph: {
      title: card.title,
      description: card.rawText || card.title,
      images: image ? [{ url: image }] : [],
    },
  };
}

export default async function PublicCardPage({ params }: Props) {
  const { id } = await params;
  const card = db.select().from(cards).where(eq(cards.id, id)).get();

  if (!card) notFound();

  const data = JSON.parse(card.data || "{}");
  const tags: string[] = JSON.parse(card.tags || "[]");
  const heroImage =
    data.coverUrl || data.artworkUrl || data.posterUrl || data.ogImage;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 sm:p-8">
      {/* Top Header */}
      <header className="w-full max-w-2xl flex items-center justify-between pb-6 border-b border-border/50">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to BrainSpace</span>
        </Link>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          <span>Shared Memory</span>
        </span>
      </header>

      {/* Main Card Container */}
      <main className="w-full max-w-2xl mt-8 flex flex-col gap-6">
        <article className="overflow-hidden rounded-3xl border border-border/70 bg-card p-6 sm:p-8 shadow-md">
          {/* Hero Visual (Pinterest-style) */}
          {heroImage && (
            <div className="relative mb-6 overflow-hidden rounded-2xl bg-secondary/30 max-h-96 w-full flex justify-center">
              <img
                src={heroImage}
                alt={card.title}
                className="w-full max-h-96 object-contain rounded-2xl"
              />
            </div>
          )}

          {/* Color Swatch */}
          {card.intent === "color" && data.hex && (
            <div
              className="w-full h-24 rounded-2xl border border-border/50 mb-6 flex items-end p-3 shadow-inner"
              style={{ backgroundColor: data.hex }}
            >
              <span className="rounded bg-black/60 px-2 py-1 font-mono text-xs font-bold text-white backdrop-blur-xs">
                {data.hex}
              </span>
            </div>
          )}

          {/* Header Metadata */}
          <div className="flex flex-wrap items-center gap-2 pb-3 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold uppercase tracking-wider text-primary">
              {card.intent}
            </span>
            {card.subtype && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium text-foreground">
                {card.subtype}
              </span>
            )}
            <span className="ms-auto flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(card.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-2">
            {card.title}
          </h1>

          {/* Quote layout (Tumblr style) */}
          {card.intent === "quote" ? (
            <blockquote className="my-6 border-s-4 border-primary/60 ps-4 italic text-lg sm:text-xl text-foreground/90 font-serif">
              “{card.rawText}”
            </blockquote>
          ) : (
            card.rawText &&
            card.rawText !== card.title && (
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {card.rawText}
              </p>
            )
          )}

          {/* Keep-style Interactive/Static Checklist */}
          {Array.isArray(data.items) && data.items.length > 0 && (
            <div className="mt-6 flex flex-col gap-2 rounded-2xl bg-secondary/30 p-4 border border-border/50">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground pb-2 border-b border-border/40">
                <CheckSquare className="size-3.5 text-primary" />
                <span>Checklist ({data.items.length} items)</span>
              </div>
              <ul className="flex flex-col gap-2 mt-1">
                {data.items.map((item: any, idx: number) => (
                  <li
                    key={item.id || idx}
                    className="flex items-center gap-2.5 text-sm text-foreground"
                  >
                    <span
                      className={`size-4 rounded border flex items-center justify-center text-[10px] ${
                        item.done
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted-foreground/40 bg-card"
                      }`}
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <span
                      className={item.done ? "line-through text-muted-foreground" : ""}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Location / OpenStreetMap Link */}
          {data.mapUrl && (
            <div className="mt-5">
              <a
                href={data.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <MapPin className="size-3.5" />
                <span>View location on OpenStreetMap</span>
              </a>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5 pt-4 border-t border-border/40">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* Agent Machine-Readable API Payload Box */}
        <section className="rounded-2xl border border-border/60 bg-secondary/20 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
              Semantic Agent Payload (JSON)
            </span>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-card p-3 font-mono text-[11px] text-muted-foreground border border-border/40 max-h-48">
            {JSON.stringify(
              {
                id: card.id,
                title: card.title,
                intent: card.intent,
                subtype: card.subtype,
                data,
                tags,
                createdAt: card.createdAt,
              },
              null,
              2
            )}
          </pre>
        </section>
      </main>
    </div>
  );
}
