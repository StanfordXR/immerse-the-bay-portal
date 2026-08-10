import type { Metadata, Viewport } from "next";
import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Nightscape } from "@/components/nightscape";

// The brand display face from the marketing site (immersethebay.org) — the
// sliced "IMMERSE THE BAY" title. Uppercase display only; body text stays Plex.
const glitch = localFont({
  src: "./fonts/glitch.ttf",
  variable: "--font-glitch",
  display: "swap",
});

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Apply — Immerse the Bay 2026",
    template: "%s — Immerse the Bay 2026",
  },
  description:
    "Application portal for Immerse the Bay 2026, Stanford XR's annual hackathon. November 13–15 at Stanford.",
};

export const viewport: Viewport = {
  themeColor: "#0a0514",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${chakra.variable} ${plex.variable} ${plexMono.variable} ${glitch.variable}`}
    >
      <body className="min-h-dvh">
        <Nightscape />
        {children}
      </body>
    </html>
  );
}
