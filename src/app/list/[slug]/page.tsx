import React from "react";
import { notFound } from "next/navigation";
import { getListBySlugWithItems } from "@/lib/lists/service";
import { generateListJsonLd } from "@/lib/federation/jsonld";
import { PublicBoardView } from "./PublicBoardView";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";

export default async function ListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data;
  try {
    data = await getListBySlugWithItems(slug);
  } catch (err: any) {
    if (err.message?.includes("FORBIDDEN")) {
      return (
        <main className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0a09] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold font-serif text-neutral-900 dark:text-neutral-100 mb-2">
            Private Curated Board
          </h1>
          <p className="text-sm text-neutral-500 max-w-sm mb-6">
            This collection is set to Private by its curator and cannot be viewed publicly.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Curio Feed</span>
          </Link>
        </main>
      );
    }
    throw err;
  }

  if (!data) {
    notFound();
  }

  const allItems = data.sections.flatMap((s) => s.items);
  const jsonLd = generateListJsonLd(data.list, allItems, data.owner);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <PublicBoardView data={data} />
    </>
  );
}

