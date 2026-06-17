import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, requireEngineContext, recordQuota } from "@/lib/engine";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/html",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "image/png",
  "image/jpeg",
  "image/tiff",
]);

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

export async function POST(req: NextRequest) {
  const ctx = await requireEngineContext(req, "brain.write", "heavy", "uploads");
  if (ctx instanceof Response) return ctx;
  const configError = engineConfigurationResponse();
  if (configError) return configError;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "file_required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "file_too_large", maxSize: MAX_FILE_SIZE }, { status: 413 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json(
        { error: "unsupported_file_type", allowed: Array.from(ALLOWED_MIME_TYPES) },
        { status: 415 }
      );
    }

    // Sanitize filename in a new FormData
    const cleanForm = new FormData();
    cleanForm.append("file", new File([file], sanitizeFilename(file.name), { type: file.type }));
    const title = formData.get("title");
    if (typeof title === "string") cleanForm.append("title", title);
    const source = formData.get("source");
    if (typeof source === "string") cleanForm.append("source", source);
    const tags = formData.get("tags");
    if (typeof tags === "string") cleanForm.append("tags", tags);

    const upstream = await fetch(`${ENGINE_URL}/api/upload`, {
      method: "POST",
      headers: ctx.headers,
      body: cleanForm,
    });

    const text = await upstream.text();
    if (upstream.ok) {
      void recordQuota(ctx, "uploads");
      // ── Auto-analysis: fire-and-forget ────────────────────────────────
      // Uses x-internal-secret for service-to-service auth.
      // NEVER pass engine headers in the request body.
      const internalSecret = process.env.SIGMABRAIN_INTERNAL_SECRET;
      if (internalSecret) {
        try {
          const uploadResult = JSON.parse(text) as { slug?: string; title?: string };
          if (uploadResult.slug) {
            void fetch(`${req.nextUrl.origin}/api/legal/analyze`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-secret": internalSecret,
              },
              body: JSON.stringify({
                document_slug: uploadResult.slug,
                brain_id: ctx.brainId,
              }),
            }).catch(() => {/* silent: analysis is best-effort */});
          }
        } catch {
          // JSON parse failed or no slug — skip auto-analysis
        }
      }
      // ──────────────────────────────────────────────────────────────────
    }
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[upload] failed:", err instanceof Error ? err.message : String(err));
    return Response.json(
      { error: "Sigmabrain Engine nicht erreichbar. Starte: gbrain serve" },
      { status: 503 }
    );
  }
}
