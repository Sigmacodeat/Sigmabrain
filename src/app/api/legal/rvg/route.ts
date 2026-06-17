import { NextRequest } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { calculateRvg } from "@/lib/rvg";

export const dynamic = "force-dynamic";

/**
 * POST /api/legal/rvg
 *
 * RVG §13 Gebührenberechnung für deutsche Kanzleien.
 * Berechnet Verfahrensgebühr (1.3), Terminsgebühr (1.2), Einigungsgebühr (1.5)
 * und Auslagenpauschale aus dem Streitwert.
 *
 * Body:
 *   streitwert  number   required  Streitwert in EUR
 *   gebuehren   string[] optional  Welche Gebühren berechnen: ["verfahren", "termin", "einigung"]
 *                                  Default: alle drei
 *
 * Response: {
 *   streitwert, basisGebuehr, verfahrensgebuehr, terminsgebuehr,
 *   einigungsgebuehr, auslagenpauschale, summeNetto, mwst, summeBrutto
 * }
 *
 * GET /api/legal/rvg?streitwert=25000
 * Schnellabfrage via QueryString.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("legal.judgements");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const raw = body.streitwert;
  const streitwert = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  if (!Number.isFinite(streitwert) || streitwert <= 0) {
    return Response.json({ error: "streitwert_required", hint: "Positive number in EUR" }, { status: 400 });
  }
  if (streitwert > 100_000_000) {
    return Response.json({ error: "streitwert_too_large", max: 100_000_000 }, { status: 400 });
  }

  const result = calculateRvg(streitwert);
  return Response.json(result);
}

export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("legal.judgements");
  if (ctx instanceof Response) return ctx;

  const raw = new URL(req.url).searchParams.get("streitwert");
  const streitwert = raw ? parseFloat(raw) : NaN;
  if (!Number.isFinite(streitwert) || streitwert <= 0) {
    return Response.json({ error: "streitwert_required" }, { status: 400 });
  }

  return Response.json(calculateRvg(streitwert));
}
