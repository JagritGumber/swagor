import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Cheap session-cookie presence check. Better Auth verifies the cookie
 * cryptographically on the route handler / server component side; the
 * middleware just gate-keeps to avoid serving dashboard chrome to
 * obvious anonymous traffic. Note: per Next 16, this file may eventually
 * rename to proxy.ts — keeping the legacy filename until the warning
 * forces a rename.
 */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const cookie = getSessionCookie(request);
    if (!cookie) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
