import HeaderAuth from "@/components/header-auth";
import { NavBrand } from "@/components/nav-brand";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { Web3Providers } from "./providers";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans-family" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-family" });

const defaultUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Selbo · Public AI Crypto Trader on Arc",
  description:
    "Deploy your own AI trader on Arc Testnet. Panel-reviewed, OHLCV-charted, anchored on-chain. Free, simulated, verifiable.",
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
          <Web3Providers>
            <Toaster expand theme="dark" />
            <div className="flex min-h-screen flex-col bg-black">
              <nav className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[var(--hairline-strong)] bg-black/85 backdrop-blur-md">
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
          </Web3Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
