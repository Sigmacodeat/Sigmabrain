import { NextRequest } from "next/server";
import { ENGINE_URL, engineConfigurationResponse, engineHeaders, unauthorized } from "@/lib/engine";

export async function POST(req: NextRequest) {
  const auth = await engineHeaders();
  if (!auth) return unauthorized();
  const configError = engineConfigurationResponse();
  if (configError) return configError;
  try {
    const formData = await req.formData();
    const upstream = await fetch(`${ENGINE_URL}/api/upload`, {
      method: "POST",
      headers: auth,
      body: formData,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { error: "Sigmabrain Engine nicht erreichbar. Starte: gbrain serve" },
      { status: 503 }
    );
  }
}
