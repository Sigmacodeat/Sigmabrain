import { NextRequest } from "next/server";
import { requireEngineContext, recordQuota } from "@/lib/engine";
import { api } from "@/lib/api";
import type { TimeEntry } from "@/lib/legal-types";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/time?caseSlug=cases/fall-001&billable=true&unbilled=true
 *
 * List time entries. Filters:
 *   caseSlug   string   Filter by case slug
 *   billable   boolean  Only billable entries
 *   unbilled   boolean  Only entries not yet on an invoice
 *   from       date     ISO date filter start
 *   to         date     ISO date filter end
 *   lawyer     string   Filter by lawyer name
 *   limit      number   Max results (default 200)
 */
export async function GET(req: NextRequest) {
  const ctx = await requireEngineContext(req, "invoice.read", "standard");
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const caseSlug = searchParams.get("caseSlug") || searchParams.get("case_slug") || "";
  const billableOnly = searchParams.get("billable") === "true";
  const unbilledOnly = searchParams.get("unbilled") === "true";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const lawyerFilter = searchParams.get("lawyer") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

  try {
    // Time entries are stored inside case page frontmatter.time_entries
    // OR as standalone "time_entry" pages for cross-case billing views.
    let entries: (TimeEntry & { case_slug?: string })[] = [];

    if (caseSlug) {
      const casePage = await api.brain.getPage(caseSlug).catch(() => null);
      if (casePage) {
        const fm = casePage.frontmatter as Record<string, unknown>;
        const raw = Array.isArray(fm.time_entries) ? fm.time_entries as TimeEntry[] : [];
        entries = raw.map((e) => ({ ...e, case_slug: caseSlug }));
      }
    } else {
      // Fetch standalone time_entry pages (for aggregated view)
      const pages = await api.brain.listPages({ type: "time_entry", limit });
      entries = pages.map((p) => {
        const fm = p.frontmatter as Record<string, unknown>;
        return {
          id: p.slug,
          description: String(fm.description ?? ""),
          minutes: Number(fm.minutes ?? 0),
          date: String(fm.date ?? ""),
          rate: fm.rate ? Number(fm.rate) : undefined,
          billable: Boolean(fm.billable),
          billed: Boolean(fm.billed),
          invoice_number: fm.invoice_number ? String(fm.invoice_number) : undefined,
          lawyer: fm.lawyer ? String(fm.lawyer) : undefined,
          activity_type: fm.activity_type ? String(fm.activity_type) : undefined,
          case_slug: fm.case_slug ? String(fm.case_slug) : undefined,
        };
      });
    }

    // Apply filters
    if (billableOnly) entries = entries.filter((e) => e.billable);
    if (unbilledOnly) entries = entries.filter((e) => !e.billed);
    if (from) entries = entries.filter((e) => e.date >= from);
    if (to) entries = entries.filter((e) => e.date <= to);
    if (lawyerFilter) entries = entries.filter((e) => e.lawyer?.toLowerCase().includes(lawyerFilter.toLowerCase()));

    entries = entries.slice(0, limit);

    const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
    const totalAmount = entries.reduce((sum, e) => {
      if (!e.billable) return sum;
      const hours = (e.minutes || 0) / 60;
      return sum + hours * (e.rate || 0);
    }, 0);

    return Response.json({
      entries,
      total: entries.length,
      summary: {
        total_minutes: totalMinutes,
        total_hours: Math.round(totalMinutes / 60 * 100) / 100,
        billable_amount: Math.round(totalAmount * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[time] list failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "load_failed" }, { status: 500 });
  }
}

/**
 * POST /api/time
 * Create a time entry on a case or as standalone.
 *
 * Body:
 *   case_slug      string  required  Akte-Slug
 *   description    string  required  Tätigkeit (max 500 Zeichen)
 *   minutes        number  required  Dauer in Minuten
 *   date           string  required  ISO-Datum (YYYY-MM-DD)
 *   rate           number  optional  Stundensatz in EUR
 *   billable       boolean optional  Abrechenbar (default: true)
 *   activity_type  string  optional  "research" | "drafting" | "court" | "meeting" | "other"
 *   lawyer         string  optional  Bearbeiter
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "invoice.write", "standard");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const caseSlug = typeof body.case_slug === "string" ? body.case_slug.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const minutes = typeof body.minutes === "number" ? Math.round(body.minutes) : parseInt(String(body.minutes || ""), 10);
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "";

  if (!caseSlug) return Response.json({ error: "case_slug_required" }, { status: 400 });
  if (!description) return Response.json({ error: "description_required" }, { status: 400 });
  if (!Number.isFinite(minutes) || minutes <= 0) return Response.json({ error: "minutes_required_positive" }, { status: 400 });
  if (!date) return Response.json({ error: "date_required_iso" }, { status: 400 });

  const VALID_ACTIVITY = new Set(["research", "drafting", "court", "meeting", "other"]);
  const activityType = typeof body.activity_type === "string" && VALID_ACTIVITY.has(body.activity_type)
    ? body.activity_type : "other";
  const rate = typeof body.rate === "number" && body.rate >= 0 ? body.rate : undefined;
  const billable = body.billable !== false;
  const lawyer = typeof body.lawyer === "string" ? body.lawyer.trim().slice(0, 100) : ctx.user.name || ctx.user.email;

  const id = `time-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const entry: TimeEntry = { id, description, minutes, date, rate, billable, billed: false, lawyer, activity_type: activityType };

  // Append to case page frontmatter.time_entries
  const casePage = await api.brain.getPage(caseSlug).catch(() => null);
  if (!casePage) return Response.json({ error: "case_not_found", caseSlug }, { status: 404 });

  const fm = casePage.frontmatter as Record<string, unknown>;
  const existing = Array.isArray(fm.time_entries) ? fm.time_entries as TimeEntry[] : [];
  existing.push(entry);

  await api.brain.updatePage({
    slug: caseSlug,
    frontmatter: { ...fm, time_entries: existing },
  });

  void logAudit("case.update", "case", {
    entityId: caseSlug,
    details: { action: "time_entry_added", minutes, billable, description: description.slice(0, 80) },
  });

  return Response.json({ entry, case_slug: caseSlug }, { status: 201 });
}

/**
 * PATCH /api/time
 * Update a time entry on a case (by id within case frontmatter).
 *
 * Body: { case_slug, id, ...fields }
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireEngineContext(req, "invoice.write", "standard");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const caseSlug = typeof body.case_slug === "string" ? body.case_slug.trim() : "";
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!caseSlug || !id) return Response.json({ error: "case_slug_and_id_required" }, { status: 400 });

  const casePage = await api.brain.getPage(caseSlug).catch(() => null);
  if (!casePage) return Response.json({ error: "case_not_found" }, { status: 404 });

  const fm = casePage.frontmatter as Record<string, unknown>;
  const entries = Array.isArray(fm.time_entries) ? fm.time_entries as TimeEntry[] : [];
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return Response.json({ error: "time_entry_not_found" }, { status: 404 });

  const allowed: (keyof TimeEntry)[] = ["description", "minutes", "date", "rate", "billable", "billed", "lawyer", "activity_type", "invoice_number"];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      (entries[idx] as unknown as Record<string, unknown>)[key] = body[key];
    }
  }

  await api.brain.updatePage({ slug: caseSlug, frontmatter: { ...fm, time_entries: entries } });
  return Response.json({ entry: entries[idx] });
}

/**
 * DELETE /api/time
 * Remove a time entry from a case.
 *
 * Body: { case_slug, id }
 */
export async function DELETE(req: NextRequest) {
  const ctx = await requireEngineContext(req, "invoice.write", "standard");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const caseSlug = typeof body.case_slug === "string" ? body.case_slug.trim() : "";
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!caseSlug || !id) return Response.json({ error: "case_slug_and_id_required" }, { status: 400 });

  const casePage = await api.brain.getPage(caseSlug).catch(() => null);
  if (!casePage) return Response.json({ error: "case_not_found" }, { status: 404 });

  const fm = casePage.frontmatter as Record<string, unknown>;
  const entries = Array.isArray(fm.time_entries) ? fm.time_entries as TimeEntry[] : [];
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) return Response.json({ error: "time_entry_not_found" }, { status: 404 });

  await api.brain.updatePage({ slug: caseSlug, frontmatter: { ...fm, time_entries: filtered } });
  return Response.json({ ok: true });
}
