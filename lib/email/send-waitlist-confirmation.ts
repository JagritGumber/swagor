import "server-only";
import { waitlistConfirmation } from "./compiled-templates";
import { sendTransactionalEmail } from "./brevo.service";
import { firstNameOrFriend } from "./first-name";

/**
 * Send the personalized "you're on the list" email. Fires fire-and-forget
 * from ensureSelboInstance when BETA_CODE is set. Substitutes the user's
 * first name into the `{{NAME}}` placeholders in the compiled template;
 * falls back to "friend" if the name is missing or just an email handle.
 */
export async function sendWaitlistConfirmation(
  to: string,
  toName?: string,
): Promise<void> {
  const name = firstNameOrFriend(toName, to);
  const html = waitlistConfirmation.replace(/\{\{NAME\}\}/g, name);
  await sendTransactionalEmail({
    to,
    toName,
    subject: `${name}, you're on the Selbo list`,
    htmlContent: html,
  });
}
