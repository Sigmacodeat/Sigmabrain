import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import ServiceWorkerRegister from "@/components/pwa/sw-register";
import RefConsentBanner from "@/components/marketing/ref-consent";
import "./globals.css";

// next/font self-hosts at build time — zero runtime requests to Google
// (GDPR: no visitor IP ever reaches fonts.googleapis.com) and no
// render-blocking CSS @import.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Sigmabrain — the brain your firm never had",
    template: "%s — Sigmabrain",
  },
  description:
    "Every meeting, deal, email and document — turned into one answer instead of ten search results. With citations, and an honest note on what it doesn't know yet.",
  keywords: [
    "Sigmabrain",
    "company brain",
    "institutional memory",
    "AI knowledge base",
    "knowledge graph",
    "RAG",
    "self-hosted AI",
    "Wissensgraph",
    "Firmen-Gedächtnis",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://sigmabrain.com"),
  openGraph: {
    title: "Sigmabrain — the brain your firm never had",
    description:
      "One answer instead of ten search results. Self-hosted or EU cloud, built on an open-source engine.",
    type: "website",
    siteName: "Sigmabrain",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Sigmabrain — your firm forgets. Sigmabrain doesn't." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sigmabrain — the brain your firm never had",
    description: "One answer instead of ten search results.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sigmabrain",
  },
};

export const viewport: Viewport = {
  themeColor: "#06060f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`} style={{ colorScheme: "dark" }}>
      <body className="min-h-full bg-[#06060f] text-[#e8e8f0] antialiased noise">
        {children}
        <RefConsentBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
