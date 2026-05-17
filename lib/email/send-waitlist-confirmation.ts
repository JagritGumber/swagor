import "server-only";
import { waitlistConfirmation } from "./compiled-templates";
import { sendTransactionalEmail } from "./brevo.service";

/**
 * Send the "You're on the Selbo waitlist" confirmation email. Fires after
 * a new selbo_instances row is provisioned with betaAccessGranted=false.
 * Best-effort: failures are caught upstream; the user signup flow never
 * blocks on email delivery.
 */
export async function sendWaitlistConfirmation(
  to: string,
  toName?: string,
): Promise<void> {
  await sendTransactionalEmail({
    to,
    toName,
    subject: "You're on the Selbo waitlist",
    htmlContent: waitlistConfirmation,
  });
}
