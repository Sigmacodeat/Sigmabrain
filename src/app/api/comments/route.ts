import { NextRequest } from "next/server";
import { requireEngineContext } from "@/lib/engine";
import { addComment, listComments } from "@/lib/comments";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/comments?parentSlug=cases/fall-001&limit=100
 * List all comments on a Brain page (case, deadline, invoice, etc.).
 */
export async function GET(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.read", "standard");
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const parentSlug = searchParams.get("parentSlug") || searchParams.get("parent_slug") || "";
  if (!parentSlug.trim()) {
    return Response.json({ error: "parentSlug_required" }, { status: 400 });
  }

  try {
    const comments = await listComments(parentSlug);
    return Response.json({ comments, total: comments.length });
  } catch (err) {
    console.error("[comments] list failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "load_failed" }, { status: 500 });
  }
}

/**
 * POST /api/comments
 * Add a comment to a Brain page.
 *
 * Body: { parent_slug, content, thread_id? }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.write", "standard");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parentSlug = typeof body.parent_slug === "string" ? body.parent_slug.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const threadId = typeof body.thread_id === "string" ? body.thread_id.trim() : undefined;

  if (!parentSlug) return Response.json({ error: "parent_slug_required" }, { status: 400 });
  if (!content || content.length < 1) return Response.json({ error: "content_required" }, { status: 400 });
  if (content.length > 10_000) return Response.json({ error: "content_too_long", max: 10_000 }, { status: 413 });

  try {
    const comment = await addComment({
      parentSlug,
      parentType: "page",
      authorId: ctx.user.id,
      authorName: ctx.user.name || ctx.user.email,
      content,
      threadId,
    });
    return Response.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("[comments] create failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "create_failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/comments
 * Delete a comment by slug. Only the author or an admin can delete.
 *
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.write", "standard");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return Response.json({ error: "id_required" }, { status: 400 });

  try {
    const page = await api.brain.getPage(id);
    if (!page) return Response.json({ error: "not_found" }, { status: 404 });

    const fm = page.frontmatter as Record<string, unknown>;
    if (fm.author_id !== ctx.user.id && ctx.user.role !== "admin") {
      return Response.json({ error: "forbidden_not_author" }, { status: 403 });
    }

    await api.brain.deletePage(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[comments] delete failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
}
