import { ImageResponse } from "next/og";

// Next 16 file-convention OG image. Renders 1200x630 PNG on demand for OG
// crawlers (Twitter, LinkedIn, Discord, etc.). System fonts only — keeps the
// route fast and avoids shipping a TTF asset for a marketing pixel.
//
// Design here is intentionally text-only and minimal: the project is OSS +
// donation-funded, no design budget yet. Swap in a real graphic when one
// exists by replacing this file with an opengraph-image.png in the same
// directory (Next picks up static images automatically).
//
// IMPORTANT: Satori (the SVG-to-image engine next/og wraps) requires every
// div with more than one child to declare `display: flex` (or `contents`
// or `none`). Without that, image generation throws. Default display:
// "block" on multi-child divs will silently break the route. All multi-
// child divs below declare flex explicitly.

export const alt = "Thinking Outside the Box — Ask anything. See who's wondering the same.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#5b21b6",
          color: "#fafaf7",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 120,
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
          }}
        >
          {/* Two lines: "Thinking Outside" + "the Box". A single line at 120px
              overflows the 1200px-wide canvas with this longer wordmark. */}
          <span>Thinking Outside</span>
          <span>the Box</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 32,
            fontSize: 40,
            opacity: 0.85,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {/* Two-sentence tagline, one sentence per line. */}
          <span>Ask anything.</span>
          <span>See who&apos;s wondering the same.</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 80,
            gap: 24,
            fontSize: 22,
            opacity: 0.7,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          <span>AI chats in public</span>
          <span>·</span>
          <span>Open source</span>
          <span>·</span>
          <span>No login</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
