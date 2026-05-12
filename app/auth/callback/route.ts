/**
 * Supabase OAuth / email-confirm callback.
 * Exchanges the magic-link/oauth `code` for a session, then redirects.
 *
 * Simplified from the arc-escrow original: no profiles/wallets table
 * lookups, no per-user Circle wallet creation. We don't maintain a
 * separate profiles table; auth.users is the source of truth for users.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/auth/auth-error`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth callback exchange failed:", error.message);
    return NextResponse.redirect(`${baseUrl}/auth/auth-error`);
  }

  return NextResponse.redirect(`${baseUrl}${nextPath.startsWith("/") ? nextPath : `/${nextPath}`}`);
}
