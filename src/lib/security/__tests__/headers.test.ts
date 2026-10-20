import { describe, expect, it } from "bun:test";
import nextConfig from "../../../../next.config";

describe("HTTP Security Headers & Content Security Policy (Phase 8 / Security)", () => {
  it("next.config.ts configures strict security headers with Google Fonts and Stripe/Google Pay", async () => {
    expect(nextConfig.headers).toBeDefined();

    const headersConfig = await nextConfig.headers!();
    expect(headersConfig.length).toBeGreaterThan(0);

    const rootHeaders = headersConfig[0].headers;
    const headerMap = new Map(rootHeaders.map((h: any) => [h.key, h.value]));

    // 1. Core security headers
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

    // 2. CSP Directive verification
    const csp = headerMap.get("Content-Security-Policy");
    expect(csp).toBeDefined();

    // Google Fonts
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");

    // Stripe & Google Pay
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("https://pay.google.com");
    expect(csp).toContain("https://api.stripe.com");

    // Media frames
    expect(csp).toContain("https://www.youtube.com");
    expect(csp).toContain("https://open.spotify.com");
  });
});
