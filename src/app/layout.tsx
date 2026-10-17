import type { Metadata } from "next";
import { ClientFetchInterceptor } from "@/components/providers/ClientFetchInterceptor";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curio — Taste Graph & Autonomous Memory",
  description: "Capture at Keep speed. Curate with Pinterest elegance. Engineered for Agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var orig = window.fetch;
                if (!orig) return;
                window.fetch = function(input, init) {
                  if (typeof input === 'string') {
                    if (input.startsWith('/api/')) input = '/curio' + input;
                  } else if (input && input.url && typeof input.url === 'string') {
                    try {
                      var u = new URL(input.url, window.location.origin);
                      if (u.pathname.startsWith('/api/')) {
                        input = new Request('/curio' + u.pathname + u.search, input);
                      }
                    } catch (e) {}
                  }
                  return orig.call(this, input, init);
                };
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-[#fafaf9] text-[#1a1a19] selection:bg-neutral-900 selection:text-white dark:bg-[#0c0a09] dark:text-[#fafaf9]">
        <ClientFetchInterceptor>{children}</ClientFetchInterceptor>
      </body>
    </html>
  );
}
