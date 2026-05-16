"use client";

import { useEffect } from "react";

/**
 * Root catastrophic error boundary. Catches errors that would otherwise
 * crash the whole tree (including the root layout). Replaces the entire
 * page UI -- so it MUST render its own html + body. Minimal styling so
 * it works even if the app's CSS failed to load.
 */
export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error.tsx]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#000", color: "#e5e5e5", fontFamily: "ui-monospace, monospace" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 22, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#a3a3a3" }}>
            The page couldn&apos;t load. Try again, or reload the tab.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              border: "1px solid #00d4ff",
              background: "rgba(0,212,255,0.1)",
              color: "#00d4ff",
              padding: "8px 16px",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Retry
          </button>
          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 10, color: "#737373", textTransform: "uppercase", letterSpacing: "0.18em" }}>
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
