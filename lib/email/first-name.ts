/**
 * Extract a first-name to address the recipient by. Order of preference:
 *   1. First whitespace-separated token of the user's display name
 *      (e.g., "Jagrit Gumber" -> "Jagrit").
 *   2. The local part of the email address with non-letter chars stripped,
 *      capitalized (e.g., "alex.kim@example.com" -> "Alex").
 *   3. The string "friend" as a warm fallback if neither produces anything
 *      meaningful (rare; empty string after sanitization).
 */
export function firstNameOrFriend(displayName: string | undefined, email: string): string {
  const fromName = (displayName ?? "").trim().split(/\s+/)[0]?.trim();
  if (fromName && /^[A-Za-z][A-Za-z'-]{1,}$/.test(fromName)) {
    return capitalize(fromName);
  }
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^A-Za-z]+/g, " ").trim().split(/\s+/)[0] ?? "";
  if (cleaned.length >= 2) return capitalize(cleaned);
  return "friend";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
