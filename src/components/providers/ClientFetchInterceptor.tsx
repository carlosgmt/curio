"use client";

import React, { useEffect } from "react";

// Automatically prefix root-relative /api/ requests with Next.js basePath (/curio)
// so client-side fetch calls correctly route through Tailscale Serve reverse proxies.
if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  (window as any).fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = `/curio${input}`;
    } else if (input instanceof URL && input.pathname.startsWith("/api/")) {
      input = new URL(`/curio${input.pathname}${input.search}`, input.origin);
    }
    return originalFetch(input, init);
  };
}

export function ClientFetchInterceptor({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
