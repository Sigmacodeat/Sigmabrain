import { NextRequest } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { searchJudgements } from "@/lib/judgements";

export const maxDuration = 30;

/**
 * Live-Judikatur-Suche: AT (RIS-OGD v2.6) + DE (openlegaldata.io).
 * Query params: q (required), jurisdiction (at|de|all), court, from, to, page, limit.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("legal.judgements");
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const rawJur = searchParams.get("jurisdiction") || "at";
  const jurisdiction = (["at", "de", "all"].includes(rawJur) ? rawJur : "at") as "at" | "de" | "all";
  const court = searchParams.get("court") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const page = Math.max(parseInt(searchParams.get("page") || "0", 10) || 0, 0);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 50);

  if (!q.trim()) {
    return Response.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const { results, errors } = await searchJudgements({ q, jurisdiction, court, from, to, page, limit });

  return Response.json({
    jurisdiction,
    query: q,
    court,
    results,
    total: results.length,
    page,
    limit,
    ...(errors.length > 0 && results.length === 0
      ? { error: `Quelle(n) nicht erreichbar: ${errors.join("; ")}` }
      : {}),
  });
}
