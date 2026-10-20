import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://pay.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "frame-src https://www.youtube.com https://open.spotify.com https://js.stripe.com https://pay.google.com",
      "connect-src 'self' https://api.stripe.com https://pay.google.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/curio",
  allowedDevOrigins: ["mini.orca-banjo.ts.net", "*.orca-banjo.ts.net", "localhost:3000"],
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/curio",
        basePath: false,
        permanent: false,
      },
      {
        source: "/.well-known/webfinger",
        destination: "/curio/.well-known/webfinger",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
