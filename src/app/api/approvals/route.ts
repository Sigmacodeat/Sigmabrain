import { NextRequest } from "next/server";
import { requireEngineContext } from "@/lib/engine";
import { api } from "@/lib/api";
import {
  agentActionFrontmatter,
  requiresApproval,
  type ActionType,
  type ApprovalStatus,
} from "@/lib/approval";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals?status=pending&limit=50
 * List Human-in-the-Loop approval items (EU AI Act Art. 22 compliance).
 */
export async function GET(req: NextRequest) {
  const ctx = await requireEngineContext(req, "agent.read", "standard");
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") || "pending";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  try {
    const pages = await api.brain.listPages({ type: "agent_action", limit });
    const items = pages
      .filter((p) => {
        const fm = p.frontmatter as Record<string, unknown>;
        if (statusFilter !== "all" && fm.status !== statusFilter) return false;
        return true;
      })
      .map((p) => {
        const fm = p.frontmatter as Record<string, unknown>;
        return {
          id: p.slug,
          action_type: fm.action_type,
          status: fm.status,
          proposed_by: fm.proposed_by,
          target_slug: fm.target_slug ?? null,
          summary: fm.summary,
          proposed_at: fm.proposed_at,
          decided_at: fm.decided_at ?? null,
          decided_by: fm.decided_by ?? null,
          reject_reason: fm.reject_reason ?? null,
        };
      });
    return Response.json({ items, total: items.length });
  } catch (err) {
    console.error("[approvals] list failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "load_failed" }, { status: 500 });
  }
}

/**
 * POST /api/approvals
 * Create a new approval request (propose an agent action for human review).
 *
 * Body: { action_type, summary, target_slug? }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "agent.write", "standard");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const VALID_ACTIONS: ActionType[] = ["document_finalize", "deadline_create", "booking_create", "message_send"];
  const actionType = typeof body.action_type === "string" ? body.action_type as ActionType : null;
  if (!actionType || !VALID_ACTIONS.includes(actionType)) {
    return Response.json({ error: "invalid_action_type", allowed: VALID_ACTIONS }, { status: 400 });
  }

  const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 500) : "";
  if (!summary) return Response.json({ error: "summary_required" }, { status: 400 });

  const targetSlug = typeof body.target_slug === "string" ? body.target_slug.trim() : undefined;
  const now = new Date();
  const slug = `agent-action/${now.toISOString().slice(0, 10)}/${actionType}-${Date.now()}`;

  await api.brain.createPage({
    slug,
    title: `Freigabe: ${summary.slice(0, 60)}`,
    type: "agent_action",
    content: summary,
    frontmatter: agentActionFrontmatter({
      action_type: actionType,
      proposed_by: ctx.user.email,
      summary,
      target_slug: targetSlug,
      at: now,
    }),
  });

  return Response.json({ id: slug, requires_approval: requiresApproval(actionType) }, { status: 201 });
}

/**
 * PATCH /api/approvals
 * Approve or reject a pending action (Human-in-the-Loop decision).
 *
 * Body: { id, decision: "approved" | "rejected", reject_reason? }
 */
export async function PATCH(req: NextRequest) {
  const ctx = await requireEngineContext(req, "agent.control", "standard");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const decision = typeof body.decision === "string" ? body.decision as ApprovalStatus : null;
  if (!id) return Response.json({ error: "id_required" }, { status: 400 });
  if (decision !== "approved" && decision !== "rejected") {
    return Response.json({ error: "decision_must_be_approved_or_rejected" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await api.brain.updatePage({
    slug: id,
    frontmatter: {
      status: decision,
      decided_at: now,
      decided_by: ctx.user.email,
      ...(decision === "rejected" && body.reject_reason
        ? { reject_reason: String(body.reject_reason).slice(0, 500) }
        : {}),
    },
  });

  void logAudit("settings.update", "agent_action", {
    entityId: id,
    details: { decision, decided_by: ctx.user.email },
  });

  return Response.json({ ok: true, id, decision, decided_at: now });
}
