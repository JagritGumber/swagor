import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { hasEnvVars } from "@/lib/utils/supabase/check-env-vars";
import { Oxanium } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import "./globals.css";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Web3Providers } from "./providers";
import { WalletConnectButton } from "@/components/wallet-connect-button";

const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-sans",
});

const defaultUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Swagora",
  description: "AI swarm portfolio agent on Arc",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={oxanium.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans">
        <ThemeProvider
          attribute="class"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <Web3Providers>
            <Toaster expand />
            <div className="min-h-screen flex flex-col">
              <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-sm border-b-foreground/10 h-16">
                <div className="w-full max-w-7xl mx-auto flex justify-between items-center h-full px-5 text-sm">
                  <div className="flex gap-5 items-center font-semibold">
                    <Link
                      href={"/"}
                      className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-amber-600 font-bold text-lg hover:opacity-80 transition-opacity"
                    >
                      Swagora
                    </Link>
                  </div>
                  <div className="flex items-center gap-3">
                    <WalletConnectButton />
                    {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                  </div>
                </div>
              </nav>

              <main className="flex-1 flex flex-col items-center pt-24 px-4">
                <div className="w-full max-w-7xl">{children}</div>
              </main>
            </div>
          </Web3Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
