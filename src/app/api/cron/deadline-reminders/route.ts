import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { loadKanzleiSettings } from "@/lib/kanzlei-settings";
import { api } from "@/lib/api";
import nodemailer from "nodemailer";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const settings = await loadKanzleiSettings();
    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      return NextResponse.json({ error: "smtp_not_configured" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: parseInt(settings.smtpPort ?? "587", 10),
      secure: settings.smtpSecure ?? false,
      auth: { user: settings.smtpUser, pass: settings.smtpPassword },
    });

    const fromAddr = settings.emailFrom ?? settings.smtpUser;
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    // Get all case pages
    const pages = await api.brain.listPages({ type: "case" });
    let sentCount = 0;
    const errors: string[] = [];

    for (const page of pages) {
      const fm = page.frontmatter as Record<string, unknown>;
      const deadlines = Array.isArray(fm.deadlines) ? fm.deadlines : [];
      const upcoming = deadlines.filter((d: Record<string, unknown>) => {
        const dd = String(d.due_date ?? d.date ?? "");
        if (!dd || dd < today) return false;
        if (dd > in3Days) return false;
        if (d.reminder_sent_at) return false;
        return true;
      }) as Array<Record<string, unknown>>;

      if (upcoming.length === 0) continue;

      const subject = `Fristen-Erinnerung — Akte ${String(fm.case_number ?? page.slug)}`;
      const html = `<p>Sehr geehrte/r ${settings.anwaltName || "Anwalt"},</p>
<p>folgende Fristen stehen in den nächsten 3 Tagen an:</p>
<ul>
${upcoming.map((d) => `<li><strong>${String(d.title ?? "Frist")}</strong> — ${String(d.due_date ?? d.date ?? "")}</li>`).join("\n")}
</ul>
<p>Akte: ${String(fm.case_number ?? page.slug)} — ${String(fm.title ?? page.title ?? "")}</p>
<p>Sigmabrain Kanzlei-OS</p>`;

      try {
        await transporter.sendMail({
          from: fromAddr,
          to: settings.kanzleiEmail ?? settings.smtpUser,
          subject,
          html,
        });

        // Mark deadlines as reminded
        const updatedDeadlines = deadlines.map((d: Record<string, unknown>) => {
          const dd = String(d.due_date ?? d.date ?? "");
          if (dd >= today && dd <= in3Days && !d.reminder_sent_at) {
            return { ...d, reminder_sent_at: now.toISOString() };
          }
          return d;
        });

        await api.brain.updatePage({
          slug: page.slug,
          frontmatter: { ...fm, deadlines: updatedDeadlines },
        });

        sentCount += upcoming.length;
      } catch (err) {
        errors.push(String(err instanceof Error ? err.message : err));
      }
    }

    return NextResponse.json({ ok: true, sentCount, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error("[deadline-reminders] failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "send_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
