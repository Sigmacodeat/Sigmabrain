import { NextRequest, NextResponse } from "next/server";
import { requireAuthAction } from "@/lib/engine";
import { generateApiKey, hashApiKey, getApiKeyPrefix } from "@/lib/api-keys";
import { getApiKeyStore } from "@/lib/api-key-store";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const ctx = await requireAuthAction("settings.read");
  if (ctx instanceof Response) return ctx;

  const store = getApiKeyStore();
  const raw = await store.listByOwner(ctx.user.id);
  const keys = raw.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    active: k.active,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt ?? null,
    createdBy: k.createdBy,
  }));
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthAction("settings.write");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const rawScopes = Array.isArray(body.scopes) ? body.scopes : ["read"];
  const VALID_SCOPES = new Set(["read", "write", "admin"]);
  const scopes = rawScopes.filter((s): s is string => typeof s === "string" && VALID_SCOPES.has(s));
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "name_required_or_too_long" }, { status: 400 });
  }
  if (scopes.length === 0) {
    return NextResponse.json({ error: "invalid_scopes" }, { status: 400 });
  }

  const { key, id } = generateApiKey();
  const secretHash = await hashApiKey(key);
  const now = new Date().toISOString();

  const stored = await getApiKeyStore().create({
    id,
    name,
    prefix: getApiKeyPrefix(key),
    secretHash,
    scopes,
    active: true,
    createdAt: now,
    createdBy: ctx.user.email,
    ownerId: ctx.user.id,
  });

  void logAudit("settings.update", "api_key", { entityId: id, details: { name, scopes } });

  // Return the plaintext key ONCE — it will never be retrievable again.
  return NextResponse.json(
    {
      key: {
        id: stored.id,
        name: stored.name,
        prefix: stored.prefix,
        scopes: stored.scopes,
        active: stored.active,
        createdAt: stored.createdAt,
      },
      plaintextKey: key,
    },
    { status: 201 },
  );
}

/** PATCH /api/api-keys — rename or revoke (active: false) a key. */
export async function PATCH(req: NextRequest) {
  const ctx = await requireAuthAction("settings.write");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const store = getApiKeyStore();
  const existing = await store.getById(id);
  if (!existing || existing.ownerId !== ctx.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const patch: { name?: string; active?: boolean } = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (typeof body.active === "boolean") patch.active = body.active;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const updated = await store.update(id, patch);
  void logAudit("settings.update", "api_key", { entityId: id, details: patch });
  return NextResponse.json({ key: updated });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAuthAction("settings.write");
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const store = getApiKeyStore();
  const existing = await store.getById(id);
  if (!existing || existing.ownerId !== ctx.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await store.delete(id);
  void logAudit("settings.update", "api_key", { entityId: id, details: { deleted: true } });
  return NextResponse.json({ ok: true });
}
