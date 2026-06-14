import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { generateApiKey, hashApiKey, getApiKeyPrefix } from "@/lib/api-keys";
import type { ApiKey } from "@/lib/api-keys";

// In-memory store for API keys (replace with DB in production)
const apiKeysStore = new Map<string, ApiKey>();

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const keys = Array.from(apiKeysStore.values()).map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    active: k.active,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    createdBy: k.createdBy,
  }));
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { name, scopes = ["read"] } = (await req.json()) as { name?: string; scopes?: string[] };
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const { key, id } = generateApiKey();
  const secretHash = await hashApiKey(key);

  const apiKey: ApiKey = {
    id,
    name,
    prefix: getApiKeyPrefix(key),
    secretHash,
    scopes,
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: user.email,
  };

  apiKeysStore.set(id, apiKey);

  // Return the plaintext key ONCE (never stored in full)
  return NextResponse.json({
    key: { id, name, prefix: apiKey.prefix, scopes, active: true, createdAt: apiKey.createdAt },
    plaintextKey: key,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  apiKeysStore.delete(id);
  return NextResponse.json({ success: true });
}
