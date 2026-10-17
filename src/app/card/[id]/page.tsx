import React from "react";
import { notFound } from "next/navigation";
import { getSaveDetails } from "@/lib/saves/service";
import { generateEntityJsonLd } from "@/lib/federation/jsonld";
import { CardDeepLinkClient } from "./CardDeepLinkClient";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const details = await getSaveDetails(id);

  if (!details) {
    notFound();
  }

  const isPublic =
    !details.save.isPrivateMemo &&
    details.save.visibility !== "PRIVATE" &&
    Boolean(details.entity);

  const jsonLd = isPublic
    ? generateEntityJsonLd(
        details.entity,
        details.sources?.[0] || null,
        details.owner || null
      )
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <CardDeepLinkClient initialDetails={details} />
    </>
  );
}

