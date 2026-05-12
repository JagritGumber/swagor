import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { hasEnvVars } from "@/lib/utils/supabase/check-env-vars";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import "./globals.css";
import { Web3Providers } from "./providers";
import { WalletConnectButton } from "@/components/wallet-connect-button";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const defaultUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Solon — Public AI Crypto Trader on Arc",
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
      className={mono.variable}
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
                <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 text-sm">
                  <Link
                    href="/"
                    className="flex items-center gap-2 font-bold uppercase tracking-[0.25em] hover:opacity-80"
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-[var(--neon-green)]"
                    />
                    <span className="text-[var(--neon-cyan)]">SOL</span>
                    <span>ON</span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <WalletConnectButton />
                    {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                  </div>
                </div>
              </nav>

              <main className="flex flex-1 flex-col items-center pt-24 px-4">
                <div className="w-full max-w-7xl">{children}</div>
              </main>
            </div>
          </Web3Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
