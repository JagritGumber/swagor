import { createSupabaseServerComponentClient } from "@/lib/supabase/server-client";
import { AuthNavLink } from "./auth-nav-link";

/**
 * Server component reads Supabase auth so first paint is correct (no Sign In
 * flash for signed-in users). Hands off to AuthNavLink which uses
 * usePathname() to swap between Dashboard and Sign Out when already inside
 * the app.
 */
export default async function AuthButton() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AuthNavLink loggedIn={!!user} />;
}
