import { NextRequest } from "next/server";
import { ENGINE_URL, engineHeadersForBrain } from "@/lib/engine";
import { getStore, getOrgStore, getSharedPgPool, type User } from "@/lib/auth/store";
import { sendMail } from "@/lib/mail";
import { computeDeadlineStatus } from "@/lib/legal-deadlines";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/deadlines — täglicher Fristen-Digest per E-Mail.
 *
 * Läuft als Vercel Cron (vercel.json) oder manuell:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/deadlines
 *
 * Pro Brain (Kanzlei): sammelt Fristen aus legal_case-Frontmattern und
 * legal_deadline-Seiten, filtert auf überfällig / kritisch (≤3 Tage) /
 * bald fällig (≤7 Tage) und schickt JEDEM Nutzer des Brains einen Digest.
 * Dedupe: maximal eine Mail pro Brain pro Kalendertag (Postgres-Log;
 * ohne DB — Dev-Modus — wird ohne Dedupe gesendet).
 */

interface DeadlineItem {
  title: string;
  dueDate: string;
  status: "overdue" | "critical" | "warning";
  caseTitle?: string;
  law?: string;
}

interface EnginePage {
  slug: string;
  title: string;
  type?: string;
  frontmatter?: Record<string, unknown>;
}

async function fetchPages(brainId: string, type: string, limit: number): Promise<EnginePage[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/pages?type=${encodeURIComponent(type)}&limit=${limit}`, {
      headers: engineHeadersForBrain(brainId),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as EnginePage[]) : [];
  } catch {
    return [];
  }
}

function classify(dueDate: string, doneFlag: unknown): DeadlineItem["status"] | null {
  if (doneFlag === "done") return null;
  const status = computeDeadlineStatus(dueDate, typeof doneFlag === "string" ? doneFlag : undefined);
  if (status === "overdue" || status === "critical" || status === "warning") return status;
  return null;
}

async function collectDeadlines(brainId: string): Promise<DeadlineItem[]> {
  const items: DeadlineItem[] = [];

  // 1. Fristen aus Akten-Frontmattern (legal_case → frontmatter.deadlines[])
  const cases = await fetchPages(brainId, "legal_case", 200);
  for (const page of cases) {
    const fm = page.frontmatter ?? {};
    const deadlines = Array.isArray(fm.deadlines) ? fm.deadlines : [];
    for (const raw of deadlines) {
      if (!raw || typeof raw !== "object") continue;
      const d = raw as Record<string, unknown>;
      const dueDate = String(d.due_date ?? d.date ?? "");
      if (!dueDate) continue;
      const status = classify(dueDate, d.status);
      if (!status) continue;
      items.push({
        title: String(d.title ?? "Frist"),
        dueDate: dueDate.slice(0, 10),
        status,
        caseTitle: page.title,
        law: d.law ? String(d.law) : undefined,
      });
    }
  }

  // 2. Eigenständige legal_deadline-Seiten
  const deadlinePages = await fetchPages(brainId, "legal_deadline", 100);
  for (const page of deadlinePages) {
    const fm = page.frontmatter ?? {};
    const dueDate = String(fm.due_date ?? fm.date ?? fm.deadline_date ?? "");
    if (!dueDate) continue;
    const status = classify(dueDate, fm.status);
    if (!status) continue;
    items.push({
      title: page.title || "Frist",
      dueDate: dueDate.slice(0, 10),
      status,
      law: fm.law ? String(fm.law) : undefined,
    });
  }

  // Überfällig zuerst, dann nach Datum.
  const rank = { overdue: 0, critical: 1, warning: 2 } as const;
  items.sort((a, b) => rank[a.status] - rank[b.status] || a.dueDate.localeCompare(b.dueDate));
  return items;
}

function renderDigest(items: DeadlineItem[], appUrl: string): { subject: string; text: string } {
  const overdue = items.filter((i) => i.status === "overdue");
  const critical = items.filter((i) => i.status === "critical");
  const warning = items.filter((i) => i.status === "warning");

  const parts: string[] = [];
  const section = (label: string, list: DeadlineItem[]) => {
    if (list.length === 0) return;
    parts.push(`${label}:`);
    for (const i of list) {
      parts.push(
        `  • ${i.dueDate} — ${i.title}${i.caseTitle ? ` (Akte: ${i.caseTitle})` : ""}${i.law ? ` [${i.law}]` : ""}`,
      );
    }
    parts.push("");
  };
  section("🔴 ÜBERFÄLLIG", overdue);
  section("🟠 KRITISCH (fällig in ≤ 3 Tagen)", critical);
  section("🟡 Bald fällig (≤ 7 Tage)", warning);

  parts.push(`Alle Fristen: ${appUrl}/dashboard/deadlines`);
  parts.push("");
  parts.push("Diese Übersicht ersetzt nicht die anwaltliche Fristenkontrolle.");

  const headline = [
    overdue.length ? `${overdue.length} überfällig` : "",
    critical.length ? `${critical.length} kritisch` : "",
    warning.length ? `${warning.length} bald fällig` : "",
  ].filter(Boolean).join(", ");

  return {
    subject: `⚖️ Fristen-Übersicht: ${headline}`,
    text: parts.join("\n"),
  };
}

/** Eine Mail pro Brain pro Kalendertag (UTC). True = heute schon gesendet. */
async function alreadyNotifiedToday(brainId: string): Promise<boolean> {
  const pool = getSharedPgPool();
  if (!pool) return false; // Dev ohne DB: kein Dedupe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sigmabrain_notify_log (
      brain_id text NOT NULL,
      day text NOT NULL,
      sent_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (brain_id, day)
    )
  `);
  const day = new Date().toISOString().slice(0, 10);
  const { rowCount } = await pool.query(
    `INSERT INTO sigmabrain_notify_log (brain_id, day) VALUES ($1, $2)
     ON CONFLICT (brain_id, day) DO NOTHING`,
    [brainId, day],
  );
  return rowCount === 0; // 0 inserted ⇒ row existed ⇒ already notified
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "cron_not_configured", message: "CRON_SECRET ist nicht gesetzt." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigmabrain.com";

  // Brain → Empfänger-Mapping: Org-Mitglieder teilen das Org-Brain.
  const users = await getStore().list();
  const orgStore = getOrgStore();
  const recipientsByBrain = new Map<string, User[]>();
  for (const user of users) {
    let brainId = user.brainId;
    if (user.orgId) {
      const org = await orgStore.getById(user.orgId);
      if (org) brainId = org.brainId;
    }
    const list = recipientsByBrain.get(brainId) ?? [];
    list.push(user);
    recipientsByBrain.set(brainId, list);
  }

  let brainsChecked = 0;
  let mailsSent = 0;
  let brainsWithDeadlines = 0;

  for (const [brainId, recipients] of recipientsByBrain) {
    brainsChecked++;
    const items = await collectDeadlines(brainId);
    if (items.length === 0) continue;
    brainsWithDeadlines++;

    if (await alreadyNotifiedToday(brainId)) continue;

    const { subject, text } = renderDigest(items, appUrl);
    for (const user of recipients) {
      const result = await sendMail({ to: user.email, subject, text });
      if (result.sent) mailsSent++;
    }
  }

  return Response.json({
    ok: true,
    brains_checked: brainsChecked,
    brains_with_deadlines: brainsWithDeadlines,
    mails_sent: mailsSent,
  });
}
