import { ImageResponse } from "next/og";

export const alt = "Selbo. Public AI Crypto Trader on Arc.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Brutalist black-and-cyan OG card. Static composition so Workers render
 * is sub-100ms. No external font fetch (system stack), no images.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000000",
          padding: "72px 80px",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 64 }}>
          <span style={{ width: 14, height: 14, background: "#00d4ff" }} />
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#00d4ff",
            }}
          >
            Selbo · Testnet
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 100,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            lineHeight: 0.95,
            textTransform: "uppercase",
          }}
        >
          <span>Deploy your</span>
          <span>
            <span style={{ color: "#00d4ff" }}>AI</span> trader.
          </span>
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 28,
            lineHeight: 1.35,
            color: "#a8a8a8",
            maxWidth: 940,
          }}
        >
          Three specialist AI agents debate every trade. A cross-model auditor reviews
          the debate. Every trade and the dissent behind it lands on Arc.
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 64,
            left: 80,
            right: 80,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.18)",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 18,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#a8a8a8",
          }}
        >
          <span>selbo.trade</span>
          <span style={{ color: "#00d4ff" }}>Built on Circle. Recorded on Arc.</span>
        </div>

        <span style={{ position: "absolute", top: 56, right: 64, color: "#00d4ff", fontSize: 14, fontFamily: "ui-monospace, monospace", letterSpacing: "0.24em" }}>
          ARC TESTNET
        </span>
      </div>
    ),
    { ...size },
  );
}
