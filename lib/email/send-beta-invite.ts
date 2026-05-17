import "server-only";
import { betaInvite } from "./compiled-templates";
import { sendTransactionalEmail } from "./brevo.service";

/**
 * Send the "You're in" beta invite email containing the shared BETA_CODE
 * the user pastes into the dashboard's BetaGate. Triggered by an admin
 * POST to /api/admin/waitlist/invite. The compiled template includes a
 * literal `{{BETA_CODE}}` placeholder that gets string-replaced here.
 */
export async function sendBetaInvite(
  to: string,
  betaCode: string,
  toName?: string,
): Promise<void> {
  const html = betaInvite.replace(/{{BETA_CODE}}/g, betaCode);
  await sendTransactionalEmail({
    to,
    toName,
    subject: "You're in: Selbo private beta",
    htmlContent: html,
  });
}
