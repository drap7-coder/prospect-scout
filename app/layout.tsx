import type { Metadata } from "next";
import { IBM_Plex_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const display = IBM_Plex_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const siteDescription =
  "Discover companies, public agencies, institutions, and operators by sector, location, and public evidence from CMS, SEC, FDA, RSS, and the open web.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Prospect Scout — Search organizations. Find the signal.",
    template: "%s · Prospect Scout",
  },
  description: siteDescription,
  icons: {
    icon: "/prospect-scout-logo.png",
    apple: "/prospect-scout-logo.png",
  },
  openGraph: {
    title: "Prospect Scout — Search organizations. Find the signal.",
    description: siteDescription,
    siteName: "Prospect Scout",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Prospect Scout — organization discovery and signal intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prospect Scout — Search organizations. Find the signal.",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
