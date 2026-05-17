import "server-only";
import { BrevoClient } from "@getbrevo/brevo";

let client: BrevoClient | null = null;

function getBrevoClient(): BrevoClient | null {
  if (client) return client;
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[brevo] BREVO_API_KEY not set; transactional email disabled");
    return null;
  }
  client = new BrevoClient({ apiKey });
  return client;
}

export type SendTransactionalEmailInput = {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
};

/**
 * Send a single transactional email via Brevo. Returns null if BREVO_API_KEY
 * is unset (dev mode -- caller should not fail because email is best-effort).
 * Sender pulled from BREVO_FROM_EMAIL + BREVO_FROM_NAME; both required when
 * BREVO_API_KEY is set, otherwise we throw so misconfiguration is loud.
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<{ messageId?: string } | null> {
  const brevo = getBrevoClient();
  if (!brevo) return null;
  const senderEmail = process.env.BREVO_FROM_EMAIL;
  const senderName = process.env.BREVO_FROM_NAME;
  if (!senderEmail || !senderName) {
    throw new Error("BREVO_FROM_EMAIL and BREVO_FROM_NAME must be set when BREVO_API_KEY is set");
  }
  const result = await brevo.transactionalEmails.sendTransacEmail({
    subject: input.subject,
    htmlContent: input.htmlContent,
    sender: { email: senderEmail, name: senderName },
    to: [{ email: input.to, name: input.toName }],
  });
  return { messageId: result.messageId };
}
