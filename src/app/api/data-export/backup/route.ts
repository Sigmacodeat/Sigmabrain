import { NextRequest } from "next/server";
import { ENGINE_URL, requireAuthAction, engineConfigurationResponse } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/data-export/backup
 *
 * Voll-Export aller Brain-Pages als JSON (komplettes Backup).
 * Admin-only. Nützlich für Migrationen, Compliance, lokale Archive.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("admin.*");
  if (ctx instanceof Response) return ctx;
  const configErr = engineConfigurationResponse();
  if (configErr) return configErr;

  try {
    const allPages: Array<Record<string, unknown>> = [];
    let page = 0;
    const perPage = 100;
    let hasMore = true;

    // Paginate through all pages
    while (hasMore && page < 50) {
      const res = await fetch(`${ENGINE_URL}/api/pages?limit=${perPage}&offset=${page * perPage}`, {
        headers: ctx.headers,
      });
      if (!res.ok) break;
      const pages = (await res.json()) as Array<Record<string, unknown>>;
      if (pages.length === 0) {
        hasMore = false;
      } else {
        allPages.push(...pages);
        page++;
      }
    }

    const exportData = {
      export_metadata: {
        type: "full_backup",
        generated_at: new Date().toISOString(),
        user_id: ctx.user.id,
        user_email: ctx.user.email,
        total_pages: allPages.length,
        format: "JSON",
        description: "Complete backup of all Brain-Pages for migration or compliance archiving",
      },
      data: allPages,
    };

    return Response.json(exportData);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "backup_failed" },
      { status: 500 }
    );
  }
}
