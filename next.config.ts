import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/curio",
  allowedDevOrigins: ["mini.orca-banjo.ts.net", "*.orca-banjo.ts.net", "localhost:3000"],
  serverExternalPackages: ["better-sqlite3"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/curio",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
