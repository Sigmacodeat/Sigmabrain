import { getKeychainAdapter } from "../keychain/adapter-factory";
import { isTauriEnvironment } from "../runtime";
import { SESSION_KEYCHAIN_KEY } from "@/core/session-types";
import type {
  DesktopLoginCredentials,
  DesktopLoginResult,
  DesktopSessionUser,
  DesktopAuthEventPayload,
} from "@/core/session-types";
import { verifySession, type SessionPayload } from "@/lib/auth/session";
import { emit } from "@tauri-apps/api/event";

const AUTH_ENDPOINT = "/api/auth/login";

function payloadToUser(payload: SessionPayload): DesktopSessionUser {
  return {
    uid: payload.uid,
    email: payload.email,
    role: String(payload.role),
  };
}

async function emitAuthEvent(
  event: "desktop-session-started" | "desktop-session-restored" | "desktop-session-ended",
  user: DesktopSessionUser | null,
  success: boolean,
  error?: string,
) {
  if (!isTauriEnvironment()) return;
  const payload: DesktopAuthEventPayload = {
    uid: user?.uid ?? "",
    email: user?.email ?? "",
    timestamp: new Date().toISOString(),
    success,
    error,
  };
  try {
    await emit(event, payload);
  } catch {
    // Event emission is best-effort; must never break auth flow.
  }
}

export class DesktopAuthService {
  async login(credentials: DesktopLoginCredentials): Promise<DesktopLoginResult> {
    try {
      const res = await fetch(AUTH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        const errText = await res.text();
        await emitAuthEvent("desktop-session-started", null, false, errText || `HTTP ${res.status}`);
        return { success: false, error: errText || `HTTP ${res.status}` };
      }

      const data = (await res.json()) as { token: string };
      const payload = await verifySession(data.token);

      if (!payload) {
        await emitAuthEvent("desktop-session-started", null, false, "Invalid session token received");
        return { success: false, error: "Invalid session token received" };
      }

      const adapter = getKeychainAdapter();
      await adapter.saveSecret(SESSION_KEYCHAIN_KEY, data.token, "session_token");

      const user = payloadToUser(payload);
      await emitAuthEvent("desktop-session-started", user, true);

      return {
        success: true,
        token: data.token,
        user,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      await emitAuthEvent("desktop-session-started", null, false, message);
      return {
        success: false,
        error: message,
      };
    }
  }

  async restoreSession(): Promise<{ user: DesktopSessionUser | null; token: string | null }> {
    const adapter = getKeychainAdapter();
    const hasSecret = await adapter.hasSecret(SESSION_KEYCHAIN_KEY);

    if (!hasSecret) {
      return { user: null, token: null };
    }

    try {
      const token = await adapter.loadSecret(SESSION_KEYCHAIN_KEY);
      const payload = await verifySession(token);

      if (!payload) {
        await adapter.deleteSecret(SESSION_KEYCHAIN_KEY);
        await emitAuthEvent("desktop-session-restored", null, false, "Invalid stored session token");
        return { user: null, token: null };
      }

      const user = payloadToUser(payload);
      await emitAuthEvent("desktop-session-restored", user, true);
      return { user, token };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Session restore failed";
      await emitAuthEvent("desktop-session-restored", null, false, message);
      return { user: null, token: null };
    }
  }

  async logout(): Promise<void> {
    const adapter = getKeychainAdapter();
    const hasSecret = await adapter.hasSecret(SESSION_KEYCHAIN_KEY);
    if (hasSecret) {
      await adapter.deleteSecret(SESSION_KEYCHAIN_KEY);
    }
    await emitAuthEvent("desktop-session-ended", null, true);
  }

  async getSessionToken(): Promise<string | null> {
    const adapter = getKeychainAdapter();
    const hasSecret = await adapter.hasSecret(SESSION_KEYCHAIN_KEY);
    if (!hasSecret) return null;

    try {
      return await adapter.loadSecret(SESSION_KEYCHAIN_KEY);
    } catch {
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getSessionToken();
    if (!token) return false;
    const payload = await verifySession(token);
    return payload !== null;
  }
}

export const authService = new DesktopAuthService();
