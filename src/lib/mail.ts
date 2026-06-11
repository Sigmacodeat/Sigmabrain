// Transactional mail — env-gated like Stripe billing: without RESEND_API_KEY
// nothing pretends to send. In that case the full message is printed to the
// server console (so local/first-customer testing works end-to-end) and the
// caller learns `sent: false` to surface an honest UI state.
//
// Provider: Resend REST API (no SDK dependency). Swap the fetch for another
// provider behind the same signature if needed.

export interface MailInput {
  to: string;
  subject: string;
  text: string;
}

export interface MailResult {
  sent: boolean;
  error?: string;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail({ to, subject, text }: MailInput): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Sigmabrain <hello@sigmabrain.com>";

  if (!apiKey) {
    console.log(
      [
        "┌─ [mail] RESEND_API_KEY not set — printing instead of sending ─┐",
        `To:      ${to}`,
        `Subject: ${subject}`,
        "",
        text,
        "└────────────────────────────────────────────────────────────────┘",
      ].join("\n"),
    );
    return { sent: false, error: "mail_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[mail] send failed (${res.status}): ${detail.slice(0, 300)}`);
      return { sent: false, error: `provider_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[mail] send failed: ${err instanceof Error ? err.message : String(err)}`);
    return { sent: false, error: "network" };
  }
}

/** Absolute base URL for links in emails. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
