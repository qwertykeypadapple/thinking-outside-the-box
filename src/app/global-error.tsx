"use client";

// Root error boundary. Catches errors thrown in the root layout itself —
// route-level error.tsx files don't reach this far up the tree.
// "use client" must be the very first line (Sentry skill troubleshooting note).
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
