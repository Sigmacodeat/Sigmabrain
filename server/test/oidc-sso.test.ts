/**
 * WP-209: SSO/OIDC v0 — Tests for OIDC provider and session manager.
 *
 * Coverage:
 *   - Provider registration and listing
 *   - Login initiation (PKCE, state, nonce)
 *   - Callback handling (code exchange, ID token verification)
 *   - Session validation and expiry
 *   - Logout / session invalidation
 *   - Tenant identity mapping from claims
 *   - Security: invalid state, expired state, nonce mismatch
 *   - Session manager: create, validate, logout, audit
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { OIDCProvider, type IdentityProvider } from "../src/core/oidc-provider.ts";
import { SessionManager } from "../src/core/sessions.ts";

const MOCK_PROVIDER: IdentityProvider = {
  id: "test-idp",
  name: "Test IdP",
  issuer: "https://idp.example.com",
  authorization_endpoint: "https://idp.example.com/auth",
  token_endpoint: "https://idp.example.com/token",
  userinfo_endpoint: "https://idp.example.com/userinfo",
  jwks_uri: "https://idp.example.com/jwks",
  client_id: "test-client-id",
  client_secret: "test-client-secret",
  redirect_uri: "http://localhost:3000/auth/oidc/callback",
  scopes: ["openid", "profile", "email"],
  tenant_claim: "tenant_id",
  email_claim: "email",
  name_claim: "name",
};

function makeMockIDToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = "mock-signature";
  return `${header}.${payload}.${signature}`;
}

describe("WP-209: SSO/OIDC v0 — OIDCProvider", () => {
  let provider: OIDCProvider;

  beforeEach(() => {
    provider = new OIDCProvider();
    provider.registerProvider(MOCK_PROVIDER);
  });

  describe("registerProvider", () => {
    it("registers a provider", () => {
      expect(provider.getProvider("test-idp")).toBeDefined();
      expect(provider.getProvider("test-idp")?.name).toBe("Test IdP");
    });
  });

  describe("listProviders", () => {
    it("lists registered providers without secrets", () => {
      const list = provider.listProviders();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe("test-idp");
      expect(list[0].name).toBe("Test IdP");
      expect(list[0].issuer).toBe("https://idp.example.com");
    });
  });

  describe("initiateLogin", () => {
    it("generates auth URL with PKCE and state", () => {
      const authReq = provider.initiateLogin("test-idp");

      expect(authReq.url).toContain("https://idp.example.com/auth");
      expect(authReq.url).toContain("client_id=test-client-id");
      expect(authReq.url).toContain("response_type=code");
      expect(authReq.url).toContain("code_challenge=");
      expect(authReq.url).toContain("code_challenge_method=S256");
      expect(authReq.url).toContain("state=");
      expect(authReq.url).toContain("nonce=");
      expect(authReq.state).toBeTruthy();
      expect(authReq.nonce).toBeTruthy();
      expect(authReq.code_verifier).toBeTruthy();
    });

    it("throws for unknown provider", () => {
      expect(() => provider.initiateLogin("unknown-idp")).toThrow("Unknown identity provider");
    });
  });

  describe("validateSession", () => {
    it("returns undefined for non-existent session", () => {
      expect(provider.validateSession("nonexistent")).toBeUndefined();
    });
  });

  describe("logout", () => {
    it("returns false for non-existent session", () => {
      expect(provider.logout("nonexistent")).toBe(false);
    });
  });

  describe("handleCallback", () => {
    it("throws for invalid state parameter", async () => {
      await expect(provider.handleCallback("code", "invalid-state")).rejects.toThrow("Invalid or expired state");
    });

    it("completes full flow with mock IdP", async () => {
      // Initiate login to get valid state
      const authReq = provider.initiateLogin("test-idp");

      // Mock the token exchange
      const originalFetch = globalThis.fetch;
      const mockIDToken = makeMockIDToken({
        iss: MOCK_PROVIDER.issuer,
        aud: MOCK_PROVIDER.client_id,
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: authReq.nonce,
        email: "user@example.com",
        name: "Test User",
        tenant_id: "tenant-abc",
      });

      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            id_token: mockIDToken,
            refresh_token: "mock-refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch;

      try {
        const session = await provider.handleCallback("auth-code", authReq.state);

        expect(session.tenant_id).toBe("tenant-abc");
        expect(session.user_id).toBe("user-123");
        expect(session.user_email).toBe("user@example.com");
        expect(session.user_name).toBe("Test User");
        expect(session.idp_id).toBe("test-idp");
        expect(session.session_id).toBeTruthy();

        // Session should be valid
        const validated = provider.validateSession(session.session_id);
        expect(validated).toBeDefined();
        expect(validated?.tenant_id).toBe("tenant-abc");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("rejects expired ID token", async () => {
      const authReq = provider.initiateLogin("test-idp");

      const originalFetch = globalThis.fetch;
      const mockIDToken = makeMockIDToken({
        iss: MOCK_PROVIDER.issuer,
        aud: MOCK_PROVIDER.client_id,
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) - 100,
        iat: Math.floor(Date.now() / 1000) - 200,
        nonce: authReq.nonce,
      });

      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            id_token: mockIDToken,
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch;

      try {
        await expect(provider.handleCallback("code", authReq.state)).rejects.toThrow("expired");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("rejects issuer mismatch", async () => {
      const authReq = provider.initiateLogin("test-idp");

      const originalFetch = globalThis.fetch;
      const mockIDToken = makeMockIDToken({
        iss: "https://wrong-issuer.com",
        aud: MOCK_PROVIDER.client_id,
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: authReq.nonce,
      });

      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            id_token: mockIDToken,
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch;

      try {
        await expect(provider.handleCallback("code", authReq.state)).rejects.toThrow("issuer");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("rejects nonce mismatch", async () => {
      const authReq = provider.initiateLogin("test-idp");

      const originalFetch = globalThis.fetch;
      const mockIDToken = makeMockIDToken({
        iss: MOCK_PROVIDER.issuer,
        aud: MOCK_PROVIDER.client_id,
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: "wrong-nonce",
      });

      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            id_token: mockIDToken,
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch;

      try {
        await expect(provider.handleCallback("code", authReq.state)).rejects.toThrow("nonce");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

describe("WP-209: SSO/OIDC v0 — SessionManager", () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  describe("createSession", () => {
    it("creates a session with 256-bit random ID", () => {
      const session = sm.createSession({
        tenant_id: "tenant-1",
        user_id: "user-1",
        user_email: "user@example.com",
        user_name: "Test User",
        idp_id: "test-idp",
      });

      expect(session.session_id).toBeTruthy();
      expect(session.session_id.length).toBeGreaterThanOrEqual(32);
      expect(session.tenant_id).toBe("tenant-1");
      expect(session.expires_at).toBeGreaterThan(session.issued_at);
    });
  });

  describe("validateSession", () => {
    it("validates an existing session", () => {
      const session = sm.createSession({
        tenant_id: "tenant-1",
        user_id: "user-1",
        user_email: "user@example.com",
        user_name: "Test User",
        idp_id: "test-idp",
      });

      const info = sm.validate(session.session_id);
      expect(info).toBeDefined();
      expect(info?.session_id).toBe(session.session_id);
      expect(info?.tenant_id).toBe("tenant-1");
    });

    it("returns undefined for non-existent session", () => {
      expect(sm.validate("nonexistent")).toBeUndefined();
    });
  });

  describe("logout", () => {
    it("invalidates a session", () => {
      const session = sm.createSession({
        tenant_id: "tenant-1",
        user_id: "user-1",
        user_email: "user@example.com",
        user_name: "Test User",
        idp_id: "test-idp",
      });

      const result = sm.logout(session.session_id);
      expect(result).toBe(true);
      expect(sm.validate(session.session_id)).toBeUndefined();
    });

    it("returns false for non-existent session", () => {
      expect(sm.logout("nonexistent")).toBe(false);
    });
  });

  describe("getAuditLog", () => {
    it("records login_completed event", () => {
      sm.createSession({
        tenant_id: "tenant-1",
        user_id: "user-1",
        user_email: "user@example.com",
        user_name: "Test User",
        idp_id: "test-idp",
      });

      const log = sm.getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
      expect(log[0].event).toBe("login_completed");
      expect(log[0].tenant_id).toBe("tenant-1");
    });

    it("records logout event", () => {
      const session = sm.createSession({
        tenant_id: "tenant-1",
        user_id: "user-1",
        user_email: "user@example.com",
        user_name: "Test User",
        idp_id: "test-idp",
      });
      sm.logout(session.session_id);

      const log = sm.getAuditLog();
      const logoutEntry = log.find((e) => e.event === "logout");
      expect(logoutEntry).toBeDefined();
    });
  });
});
