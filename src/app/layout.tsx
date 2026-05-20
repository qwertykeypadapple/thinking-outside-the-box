import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { isHumanVerified } from "@/lib/identity/human-cookie";
import { isTurnstileEnabled } from "@/lib/turnstile/verify";
import { TurnstileWidget } from "@/components/turnstile-widget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Think Outside the Box",
  description: "Think in public. Find your people.",
};

// Explicit viewport — Next 16 already injects a sensible default but pinning
// it keeps the iOS Safari behavior (no zoom on input focus, full-width layout
// at device pixel ratio) predictable.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mount the Turnstile widget only when needed: the visitor doesn't yet
  // hold a fresh totb_human cookie, and Turnstile is enabled by env. This
  // avoids loading the Cloudflare script on every page once verified, and
  // skips it entirely in dev/CI when the secret key isn't set.
  const showTurnstile = isTurnstileEnabled() && !(await isHumanVerified());
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {showTurnstile && <TurnstileWidget sitekey={sitekey} />}
      </body>
    </html>
  );
}
