import React from "react";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getSaveDetailsForViewer } from "@/lib/saves/service";
import { getOptionalAuth } from "@/lib/auth/service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { generateEntityJsonLd } from "@/lib/federation/jsonld";
import { CardDeepLinkClient } from "./CardDeepLinkClient";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let viewerUserId: string | undefined;
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionToken) {
      const auth = await getOptionalAuth(sessionToken);
      if (auth) viewerUserId = auth.user.id;
    } else {
      const hdrs = await headers();
      const auth = await getOptionalAuth(hdrs);
      if (auth) viewerUserId = auth.user.id;
    }
  } catch {
    // Non-request context fallback
  }

  const access = await getSaveDetailsForViewer(id, viewerUserId);

  if (access.status === "not_found") {
    notFound();
  }

  const details = access.status === "ok" ? access.details : null;
  const isOwner = access.status === "ok" ? access.isOwner : false;

  const jsonLd =
    details && !details.save.isPrivateMemo && details.entity
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
      <CardDeepLinkClient
        saveId={id}
        initialDetails={details}
        initialIsOwner={isOwner}
      />
    </>
  );
}

