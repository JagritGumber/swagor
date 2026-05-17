import "server-only";
import { betaInvite } from "./compiled-templates";
import { sendTransactionalEmail } from "./brevo.service";
import { firstNameOrFriend } from "./first-name";

/**
 * Send the personalized "your seat's ready" beta invite. Awaited by the
 * admin endpoint so the operator sees success/error in the response.
 * Substitutes {{NAME}} and {{BETA_CODE}} placeholders in the compiled
 * template at send time.
 */
export async function sendBetaInvite(
  to: string,
  betaCode: string,
  toName?: string,
): Promise<void> {
  const name = firstNameOrFriend(toName, to);
  const html = betaInvite
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{BETA_CODE\}\}/g, betaCode);
  await sendTransactionalEmail({
    to,
    toName,
    subject: `Your Selbo seat's ready, ${name}`,
    htmlContent: html,
  });
}
