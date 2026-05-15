/**
 * Admin gate for debug / internal-only UI surfaces.
 *
 * Reads ADMIN_EMAILS env var (comma-separated). An email is admin if it
 * appears in that list (case-insensitive, trimmed). Default: empty list
 * (no admins). The env value is bundled at build time on the server only;
 * it does NOT need to be NEXT_PUBLIC because the check happens server-side
 * during page render and the boolean is passed to client components.
 *
 * Usage on a server page:
 *   const session = await auth.api.getSession({...});
 *   const admin = isAdmin(session?.user.email);
 *   <Component admin={admin} />
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const target = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
