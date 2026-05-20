"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

// Cloudflare Turnstile invisible-mode widget. Mounted in the root layout
// when the server determines the visitor doesn't yet have a fresh
// totb_human cookie. Loads challenges.cloudflare.com/turnstile/v0/api.js,
// renders an invisible widget, executes the challenge, and POSTs the
// resulting token to /api/turnstile/verify which sets the cookie.
//
// PLAN §2.1: "invisible Cloudflare Turnstile check on first visit". This
// matches that — most visitors see nothing; bots get an interactive challenge.

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: string | HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
          size?: "normal" | "compact" | "invisible";
          execution?: "render" | "execute";
        },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

type Props = {
  // The public sitekey. Falls back to Cloudflare's official always-pass
  // test sitekey when env is unset so local dev works without a CF account.
  sitekey?: string;
};

// Cloudflare's documented always-pass test sitekey. Anyone using this in
// production effectively disables the check; we only use it when the real
// env var is missing.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const ALWAYS_PASS_TEST_SITEKEY = "1x00000000000000000000AA";

export function TurnstileWidget({ sitekey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const effectiveSitekey = sitekey || ALWAYS_PASS_TEST_SITEKEY;

  useEffect(() => {
    if (!ready) return;
    if (!window.turnstile || !containerRef.current) return;
    if (widgetIdRef.current) return; // idempotent: don't re-render

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: effectiveSitekey,
      size: "invisible",
      // The verify endpoint sets the totb_human cookie and any future
      // navigation/request sees the user as verified.
      callback: (token) => {
        void fetch("/api/turnstile/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).catch(() => {
          // Silent — next page load will re-mount the widget and retry.
        });
      },
      "error-callback": () => {
        // Network error or challenge failure. No user-visible UI on first cut
        // (the chat send will surface a "verifying you're human" 403 if the
        // user tries to chat before a retry succeeds).
      },
      "expired-callback": () => {
        widgetIdRef.current = null;
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [ready, effectiveSitekey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      {/* Invisible container — Turnstile injects its iframe in here when
          a real challenge is required. Most visitors never see anything. */}
      <div ref={containerRef} aria-hidden="true" />
    </>
  );
}
