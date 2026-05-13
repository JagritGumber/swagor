import HeaderAuth from "@/components/header-auth";
import { NavBrand } from "@/components/nav-brand";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans-family" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-family" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl?.trim()) {
  throw new Error("NEXT_PUBLIC_SITE_URL environment variable is missing or empty");
}

const title = "Selbo · Public AI Crypto Trader on Arc";
const description =
  "Deploy your own AI trader on Arc Testnet. Three specialist AI agents debate every trade, a cross-model auditor reviews the debate, every decision and every dissent is anchored on Arc.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Selbo",
  keywords: [
    "AI trader",
    "crypto AI agent",
    "Arc Testnet",
    "Circle wallet",
    "panel-reviewed trading",
    "perp futures",
    "Hyperliquid",
    "agentic AI",
  ],
  authors: [{ name: "Selbo" }],
  creator: "Selbo",
  openGraph: {
    type: "website",
    siteName: "Selbo",
    title,
    description,
    url: siteUrl,
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Selbo. Public AI Crypto Trader on Arc.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-black text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <Toaster expand theme="dark" />
          <div className="flex min-h-screen flex-col bg-black">
              <nav className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[var(--hairline-strong)] bg-black/55 backdrop-blur-xl">
                <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6 text-sm">
                  <div className="flex items-baseline gap-4">
                    <NavBrand />
                    <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
                      testnet
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <HeaderAuth />
                  </div>
                </div>
              </nav>

            <main className="flex flex-1 flex-col items-center pt-24 px-4">
              <div className="w-full max-w-screen-2xl">{children}</div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
