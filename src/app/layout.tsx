import type { Metadata } from "next";
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
      <body className="min-h-full bg-[#fafaf9] text-[#1a1a19] selection:bg-neutral-900 selection:text-white dark:bg-[#0c0a09] dark:text-[#fafaf9]">
        {children}
      </body>
    </html>
  );
}
