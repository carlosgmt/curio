import React from "react";
import { notFound } from "next/navigation";
import { getSaveDetails } from "@/lib/saves/service";
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

  return <CardDeepLinkClient initialDetails={details} />;
}
