import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { loadKanzleiSettings } from "@/lib/kanzlei-settings";
import { api } from "@/lib/api";
import nodemailer from "nodemailer";

// Mahngebühren nach RVG § 11 (vereinfacht)
function calculateReminderFee(count: number, baseAmount: number): number {
  switch (count) {
    case 1: return Math.max(20, Math.round(baseAmount * 0.5 * 100) / 100); // 0.5 Gebühr, mind. 20€
    case 2: return Math.max(40, Math.round(baseAmount * 1.0 * 100) / 100); // 1.0 Gebühr
    case 3: return Math.max(60, Math.round(baseAmount * 1.3 * 100) / 100); // 1.3 Gebühr
    default: return Math.max(20, Math.round(baseAmount * 0.5 * 100) / 100);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "lawyer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { invoiceSlug: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { invoiceSlug } = body;
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
    const status = String(fm.status ?? "draft");
    if (status !== "sent" && status !== "overdue") {
      return NextResponse.json({ error: "invoice_not_overdue" }, { status: 400 });
    }

    const client = String(fm.client ?? "");
    const clientSlug = String(fm.client_slug ?? "");
    const total = Number(fm.total ?? 0);
    const reminderCount = Number(fm.reminder_count ?? 0);
    const nextCount = reminderCount + 1;
    const fee = calculateReminderFee(nextCount, total);
    const newTotal = Math.round((total + fee) * 100) / 100;

    // Resolve email
    let recipient: string | undefined;
    if (clientSlug) {
      try {
        const contactPage = await api.brain.getPage(clientSlug);
        const cfm = contactPage.frontmatter as Record<string, unknown>;
        recipient = String(cfm.email ?? "");
      } catch { /* ignore */ }
    }
    if (!recipient) {
      return NextResponse.json({ error: "no_recipient_email" }, { status: 400 });
    }

    // Send email
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: parseInt(settings.smtpPort ?? "587", 10),
      secure: settings.smtpSecure ?? false,
      auth: { user: settings.smtpUser, pass: settings.smtpPassword },
    });

    const mahnungLabels = ["Erste Mahnung", "Zweite Mahnung", "Dritte Mahnung"];
    const label = mahnungLabels[Math.min(nextCount - 1, 2)] || `${nextCount}. Mahnung`;
    const fromAddr = settings.emailFrom ?? settings.smtpUser;

    await transporter.sendMail({
      from: fromAddr,
      to: recipient,
      subject: `${label} – Rechnung ${String(fm.invoice_number ?? invoiceSlug)}`,
      html: `<p>Sehr geehrte${client ? ` ${client}` : ""},</p>
<p>wir mussten feststellen, dass die Rechnung <strong>${String(fm.invoice_number ?? invoiceSlug)}</strong> über <strong>${total.toFixed(2)} €</strong> noch nicht beglichen wurde.</p>
<p><strong>${label}</strong></p>
<p>Mahngebühr: <strong>${fee.toFixed(2)} €</strong></p>
<p>Neuer Gesamtbetrag: <strong>${newTotal.toFixed(2)} €</strong></p>
<p>Bitte überweisen Sie den Betrag umgehend.</p>
<p>Mit freundlichen Grüßen<br/>${settings.anwaltName || settings.kanzleiName || ""}</p>`,
    });

    // Update invoice
    const sentAt = new Date().toISOString();
    const prevSent = Array.isArray(fm.reminder_sent_at) ? fm.reminder_sent_at : [];
    await api.brain.updatePage({
      slug: invoiceSlug,
      frontmatter: {
        ...fm,
        status: "overdue",
        reminder_count: nextCount,
        reminder_sent_at: [...prevSent, sentAt],
        reminder_fee: fee,
      },
    });

    return NextResponse.json({ ok: true, reminderCount: nextCount, fee, newTotal, sentTo: recipient });
  } catch (err) {
    console.error("[invoice-remind] failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "send_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
