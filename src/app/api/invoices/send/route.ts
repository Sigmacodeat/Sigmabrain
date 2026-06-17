import { NextRequest, NextResponse } from "next/server";
import { requireEngineContext } from "@/lib/engine";
import { loadKanzleiSettings } from "@/lib/kanzlei-settings";
import { api } from "@/lib/api";
import nodemailer from "nodemailer";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "invoice.write", "standard");
  if (ctx instanceof Response) return ctx;

  let body: { invoiceSlug: string; toEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { invoiceSlug, toEmail } = body;
  if (!invoiceSlug) {
    return NextResponse.json({ error: "invoiceSlug_required" }, { status: 400 });
  }

  try {
    const settings = await loadKanzleiSettings();
    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      return NextResponse.json({ error: "smtp_not_configured" }, { status: 400 });
    }

    const page = await api.brain.getPage(invoiceSlug);
    const fm = page.frontmatter as Record<string, unknown>;
    const client = String(fm.client ?? "");
    const clientSlug = String(fm.client_slug ?? "");

    // Resolve email: use provided, else contact email, else fail
    let recipient = toEmail;
    if (!recipient && clientSlug) {
      try {
        const contactPage = await api.brain.getPage(clientSlug);
        const cfm = contactPage.frontmatter as Record<string, unknown>;
        recipient = String(cfm.email ?? "");
      } catch {
        // ignore
      }
    }
    if (!recipient) {
      return NextResponse.json({ error: "no_recipient_email" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: parseInt(settings.smtpPort ?? "587", 10),
      secure: settings.smtpSecure ?? false,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
    });

    const fromAddr = settings.emailFrom ?? settings.smtpUser;
    const subject = `Rechnung ${String(fm.invoice_number ?? invoiceSlug)} – ${settings.kanzleiName || "Ihre Kanzlei"}`;
    const html = `<p>Sehr geehrte${client ? ` ${client}` : ""},</p>
<p>anbei finden Sie die Rechnung <strong>${String(fm.invoice_number ?? invoiceSlug)}</strong>.</p>
<p>Mit freundlichen Grüßen<br/>${settings.anwaltName || settings.kanzleiName || ""}</p>`;

    await transporter.sendMail({
      from: fromAddr,
      to: recipient,
      subject,
      html,
    });

    // Store sent flag in invoice frontmatter
    await api.brain.updatePage({
      slug: invoiceSlug,
      frontmatter: {
        ...fm,
        email_sent_at: new Date().toISOString(),
        email_sent_to: recipient,
      },
    });

    void logAudit("invoice.send", "invoice", {
      entityId: invoiceSlug,
      details: { sentTo: recipient },
    });
    return NextResponse.json({ ok: true, sentTo: recipient });
  } catch (err) {
    console.error("[invoice-send] failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "send_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
