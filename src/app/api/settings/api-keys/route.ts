import { NextRequest } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { getStore } from "@/lib/auth/store";
import { encrypt, decrypt } from "@/lib/encryption";
import { maskApiKey } from "@/lib/api-keys";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Prüfe ob ein String wie ein echter API-Key aussieht. */
function looksLikeApiKey(key: string): boolean {
  return key.length >= 8 && /^[A-Za-z0-9_\-\.]+$/.test(key);
}

/**
 * POST /api/settings/api-keys
 * Persistiert API-Keys server-seitig encrypted-at-rest.
 * Body: { openaiKey?, anthropicKey?, zeroEntropyKey? }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("settings.write");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawKeys = {
    openaiKey: typeof body.openaiKey === "string" ? body.openaiKey.trim() : "",
    anthropicKey: typeof body.anthropicKey === "string" ? body.anthropicKey.trim() : "",
    zeroEntropyKey: typeof body.zeroEntropyKey === "string" ? body.zeroEntropyKey.trim() : "",
  };

  // Validate key format
  for (const [name, val] of Object.entries(rawKeys)) {
    if (val && !looksLikeApiKey(val)) {
      return Response.json({ error: "invalid_key_format", field: name }, { status: 400 });
    }
  }

  // Encrypt at rest
  const encrypted = await Promise.all([
    rawKeys.openaiKey ? encrypt(rawKeys.openaiKey) : Promise.resolve(null),
    rawKeys.anthropicKey ? encrypt(rawKeys.anthropicKey) : Promise.resolve(null),
    rawKeys.zeroEntropyKey ? encrypt(rawKeys.zeroEntropyKey) : Promise.resolve(null),
  ]);

  const store = getStore();
  await store.update(ctx.user.id, {
    openaiKey: encrypted[0],
    anthropicKey: encrypted[1],
    zeroEntropyKey: encrypted[2],
  });

  void logAudit("settings.update", "api_keys", { entityId: ctx.user.id, details: { fields_updated: Object.keys(rawKeys).filter((k) => rawKeys[k as keyof typeof rawKeys]) } });

  return Response.json({ ok: true });
}

/**
 * GET /api/settings/api-keys
 * Lädt gespeicherte API-Keys (nur für den authentifizierten Nutzer).
 * Returns MASKED keys only — full keys are never sent to the client after save.
 * hasKey tells the UI whether a key is configured so it can show "configured" state.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("settings.read");
  if (ctx instanceof Response) return ctx;

  const store = getStore();
  const user = await store.getById(ctx.user.id);
  if (!user) return Response.json({ error: "user_not_found" }, { status: 404 });

  const [openaiKey, anthropicKey, zeroEntropyKey] = await Promise.all([
    decrypt(user.openaiKey),
    decrypt(user.anthropicKey),
    decrypt(user.zeroEntropyKey),
  ]);

  return Response.json({
    openaiKey: openaiKey ? maskApiKey(openaiKey) : "",
    anthropicKey: anthropicKey ? maskApiKey(anthropicKey) : "",
    zeroEntropyKey: zeroEntropyKey ? maskApiKey(zeroEntropyKey) : "",
    hasOpenaiKey: Boolean(openaiKey),
    hasAnthropicKey: Boolean(anthropicKey),
    hasZeroEntropyKey: Boolean(zeroEntropyKey),
  });
}
