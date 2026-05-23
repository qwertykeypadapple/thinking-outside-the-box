import type { Metadata, Viewport } from "next";
import "./globals.css";
import { isHumanVerified } from "@/lib/identity/human-cookie";
import { isTurnstileEnabled } from "@/lib/turnstile/verify";
import { TurnstileWidget } from "@/components/turnstile-widget";

// Public canonical URL. Env-overridable so dev / preview deploys point at the
// right host in the OG tags they ship. metadataBase makes relative OG image
// paths resolve against this.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://thinking-outside-the-box.onrender.com";

const TITLE = "Thinking Outside the Box";
const DESCRIPTION =
  "AI chats are usually private. Here they're public — and the system shows you who's exploring something similar right now.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: TITLE,
    type: "website",
    locale: "en_US",
    // /opengraph-image.tsx is auto-discovered by Next 16 and rendered on demand.
    // Listing it explicitly lets crawlers that don't follow the convention find it.
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
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
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {showTurnstile && <TurnstileWidget sitekey={sitekey} />}
      </body>
    </html>
  );
}
