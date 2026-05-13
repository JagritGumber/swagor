import { AuthNavLink } from "./auth-nav-link";

/**
 * Server wrapper kept for backward compat with app/layout.tsx. The actual
 * auth check + render is now client-side via authClient.useSession() in
 * AuthNavLink, which keeps the cookie reads off the SSR critical path.
 */
export default function AuthButton() {
  return <AuthNavLink />;
}
