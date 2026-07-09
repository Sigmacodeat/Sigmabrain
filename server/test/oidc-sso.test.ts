import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { OIDCProvider, type IdentityProvider } from '../src/core/oidc-provider.ts';
import { SessionManager } from '../src/core/sessions.ts';

// ── Test fixtures ────────────────────────────────────────────────────

const TEST_PROVIDER: IdentityProvider = {
  id: 'test-idp',
  name: 'Test IdP',
  issuer: 'https://idp.example.com',
  authorization_endpoint: 'https://idp.example.com/authorize',
  token_endpoint: 'https://idp.example.com/token',
  userinfo_endpoint: 'https://idp.example.com/userinfo',
  jwks_uri: 'https://idp.example.com/.well-known/jwks.json',
  client_id: 'test-client-id',
  client_secret: 'test-client-secret',
  redirect_uri: 'http://localhost:3000/auth/oidc/callback',
  scopes: ['openid', 'profile', 'email'],
  tenant_claim: 'tenant_id',
  email_claim: 'email',
  name_claim: 'name',
};

function makeIDToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.signature`;
}

function makeValidIDToken(provider: IdentityProvider, nonce: string, overrides?: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  return makeIDToken({
    iss: provider.issuer,
    aud: provider.client_id,
    sub: 'user-123',
    exp: now + 3600,
    iat: now,
    nonce,
    email: 'user@example.com',
    name: 'Test User',
    tenant_id: 'tenant-abc',
    ...overrides,
  });
}

// ── OIDC Provider Tests ──────────────────────────────────────────────

describe('OIDCProvider', () => {
  let provider: OIDCProvider;

  beforeEach(() => {
    provider = new OIDCProvider();
    provider.registerProvider(TEST_PROVIDER);
  });

  test('registerProvider and getProvider', () => {
    expect(provider.getProvider('test-idp')).toBeDefined();
    expect(provider.getProvider('test-idp')?.name).toBe('Test IdP');
    expect(provider.getProvider('nonexistent')).toBeUndefined();
  });

  test('listProviders returns all registered providers', () => {
    const list = provider.listProviders();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('test-idp');
    expect(list[0]!.name).toBe('Test IdP');
  });

  test('initiateLogin generates valid auth URL with PKCE', () => {
    const auth = provider.initiateLogin('test-idp', '/dashboard');

    expect(auth.url).toContain('idp.example.com/authorize');
    expect(auth.url).toContain('client_id=test-client-id');
    expect(auth.url).toContain('response_type=code');
    expect(auth.url).toContain('code_challenge_method=S256');
    expect(auth.url).toContain('code_challenge=');
    expect(auth.url).toContain('state=');
    expect(auth.url).toContain('nonce=');
    expect(auth.state).toBeTruthy();
    expect(auth.nonce).toBeTruthy();
    expect(auth.code_verifier).toBeTruthy();
  });

  test('initiateLogin throws for unknown provider', () => {
    expect(() => provider.initiateLogin('unknown-idp')).toThrow('Unknown identity provider');
  });

  test('handleCallback exchanges code and issues session', async () => {
    const auth = provider.initiateLogin('test-idp');

    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at-123',
        id_token: idToken,
        refresh_token: 'rt-123',
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      const session = await provider.handleCallback('auth-code', auth.state);

      expect(session.session_id).toBeTruthy();
      expect(session.tenant_id).toBe('tenant-abc');
      expect(session.user_id).toBe('user-123');
      expect(session.user_email).toBe('user@example.com');
      expect(session.user_name).toBe('Test User');
      expect(session.idp_id).toBe('test-idp');
      expect(session.id_token).toBe(idToken);
      expect(session.expires_at).toBeGreaterThan(Date.now());
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleCallback throws on invalid state', async () => {
    await expect(provider.handleCallback('code', 'invalid-state')).rejects.toThrow('Invalid or expired state');
  });

  test('handleCallback throws on token exchange failure', async () => {
    const auth = provider.initiateLogin('test-idp');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Token error', { status: 400 })),
    ) as unknown as typeof fetch;

    try {
      await expect(provider.handleCallback('code', auth.state)).rejects.toThrow('OIDC token exchange failed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleCallback throws on missing id_token', async () => {
    const auth = provider.initiateLogin('test-idp');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      await expect(provider.handleCallback('code', auth.state)).rejects.toThrow('missing id_token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleCallback throws on issuer mismatch', async () => {
    const auth = provider.initiateLogin('test-idp');

    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce, { iss: 'https://wrong-issuer.com' });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      await expect(provider.handleCallback('code', auth.state)).rejects.toThrow('issuer mismatch');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleCallback throws on audience mismatch', async () => {
    const auth = provider.initiateLogin('test-idp');

    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce, { aud: 'wrong-client-id' });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      await expect(provider.handleCallback('code', auth.state)).rejects.toThrow('audience mismatch');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleCallback throws on expired ID token', async () => {
    const auth = provider.initiateLogin('test-idp');

    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce, {
      exp: Math.floor(Date.now() / 1000) - 3600,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      await expect(provider.handleCallback('code', auth.state)).rejects.toThrow('ID token expired');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleCallback throws on nonce mismatch', async () => {
    const auth = provider.initiateLogin('test-idp');

    const idToken = makeValidIDToken(TEST_PROVIDER, 'wrong-nonce');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      await expect(provider.handleCallback('code', auth.state)).rejects.toThrow('nonce mismatch');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleCallback throws when tenant claim is missing', async () => {
    const auth = provider.initiateLogin('test-idp');

    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce, { tenant_id: undefined });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      await expect(provider.handleCallback('code', auth.state)).rejects.toThrow('Tenant claim not found');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleCallback supports nested tenant claim paths', async () => {
    const providerWithNestedClaim = new OIDCProvider();
    providerWithNestedClaim.registerProvider({
      ...TEST_PROVIDER,
      id: 'nested-idp',
      tenant_claim: 'organization.id',
    });

    const auth = providerWithNestedClaim.initiateLogin('nested-idp');
    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce, {
      tenant_id: undefined,
      organization: { id: 'org-xyz' },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      const session = await providerWithNestedClaim.handleCallback('code', auth.state);
      expect(session.tenant_id).toBe('org-xyz');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('state is single-use (cannot replay)', async () => {
    const auth = provider.initiateLogin('test-idp');
    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      await provider.handleCallback('code', auth.state);
      // Second use should fail
      await expect(provider.handleCallback('code', auth.state)).rejects.toThrow('Invalid or expired state');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('validateSession returns session for valid ID', async () => {
    const auth = provider.initiateLogin('test-idp');
    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      const session = await provider.handleCallback('code', auth.state);
      const validated = provider.validateSession(session.session_id);
      expect(validated).toBeDefined();
      expect(validated!.tenant_id).toBe('tenant-abc');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('validateSession returns undefined for invalid ID', () => {
    expect(provider.validateSession('nonexistent-session')).toBeUndefined();
  });

  test('logout invalidates session', async () => {
    const auth = provider.initiateLogin('test-idp');
    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      const session = await provider.handleCallback('code', auth.state);
      expect(provider.validateSession(session.session_id)).toBeDefined();

      const loggedOut = provider.logout(session.session_id);
      expect(loggedOut).toBe(true);
      expect(provider.validateSession(session.session_id)).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('logout returns false for nonexistent session', () => {
    expect(provider.logout('nonexistent')).toBe(false);
  });

  test('getSessionsForTenant returns sessions for specific tenant', async () => {
    const auth = provider.initiateLogin('test-idp');
    const idToken = makeValidIDToken(TEST_PROVIDER, auth.nonce);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({
        access_token: 'at',
        id_token: idToken,
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    ) as unknown as typeof fetch;

    try {
      await provider.handleCallback('code', auth.state);
      const tenantSessions = provider.getSessionsForTenant('tenant-abc');
      expect(tenantSessions.length).toBeGreaterThanOrEqual(1);
      expect(tenantSessions.every((s) => s.tenant_id === 'tenant-abc')).toBe(true);

      // Other tenant should have no sessions
      expect(provider.getSessionsForTenant('other-tenant')).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ── Session Manager Tests ────────────────────────────────────────────

describe('SessionManager', () => {
  test('createSession issues a valid session', () => {
    const mgr = new SessionManager();
    const session = mgr.createSession({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      user_email: 'user@test.com',
      user_name: 'Test User',
      idp_id: 'test-idp',
    });

    expect(session.session_id).toBeTruthy();
    expect(session.tenant_id).toBe('tenant-1');
    expect(session.user_id).toBe('user-1');
    expect(session.expires_at).toBeGreaterThan(Date.now());
  });

  test('validate returns session info for valid session', () => {
    const mgr = new SessionManager();
    const session = mgr.createSession({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      user_email: 'user@test.com',
      user_name: 'Test User',
      idp_id: 'test-idp',
    });

    const info = mgr.validate(session.session_id);
    expect(info).toBeDefined();
    expect(info!.tenant_id).toBe('tenant-1');
    expect(info!.user_email).toBe('user@test.com');
    expect(info!.time_remaining_ms).toBeGreaterThan(0);
  });

  test('validate returns undefined for invalid session', () => {
    const mgr = new SessionManager();
    expect(mgr.validate('nonexistent')).toBeUndefined();
  });

  test('logout invalidates session', () => {
    const mgr = new SessionManager();
    const session = mgr.createSession({
      tenant_id: 't1',
      user_id: 'u1',
      user_email: 'u@t.com',
      user_name: 'U',
      idp_id: 'idp',
    });

    expect(mgr.logout(session.session_id)).toBe(true);
    expect(mgr.validate(session.session_id)).toBeUndefined();
  });

  test('logout returns false for nonexistent session', () => {
    const mgr = new SessionManager();
    expect(mgr.logout('nonexistent')).toBe(false);
  });

  test('getTenantSessions returns only sessions for specified tenant', () => {
    const mgr = new SessionManager();
    mgr.createSession({ tenant_id: 't1', user_id: 'u1', user_email: 'a@b.com', user_name: 'A', idp_id: 'idp' });
    mgr.createSession({ tenant_id: 't2', user_id: 'u2', user_email: 'c@d.com', user_name: 'C', idp_id: 'idp' });
    mgr.createSession({ tenant_id: 't1', user_id: 'u3', user_email: 'e@f.com', user_name: 'E', idp_id: 'idp' });

    const t1Sessions = mgr.getTenantSessions('t1');
    expect(t1Sessions).toHaveLength(2);
    expect(t1Sessions.every((s) => s.tenant_id === 't1')).toBe(true);
  });

  test('audit log records login and logout events', () => {
    const mgr = new SessionManager();
    mgr.recordLoginStarted('test-idp', 'Initiated from /dashboard');

    const session = mgr.createSession({
      tenant_id: 't1',
      user_id: 'u1',
      user_email: 'u@t.com',
      user_name: 'U',
      idp_id: 'test-idp',
    });

    mgr.logout(session.session_id);

    const log = mgr.getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(3);

    const events = log.map((e) => e.event);
    expect(events).toContain('login_started');
    expect(events).toContain('login_completed');
    expect(events).toContain('logout');
  });

  test('audit log can be filtered by tenant', () => {
    const mgr = new SessionManager();
    mgr.createSession({ tenant_id: 't1', user_id: 'u1', user_email: 'a@b.com', user_name: 'A', idp_id: 'idp' });
    mgr.createSession({ tenant_id: 't2', user_id: 'u2', user_email: 'c@d.com', user_name: 'C', idp_id: 'idp' });

    const t1Log = mgr.getAuditLog('t1');
    expect(t1Log.length).toBeGreaterThan(0);
    expect(t1Log.every((e) => e.tenant_id === 't1')).toBe(true);
  });

  test('cookieName returns the session cookie name', () => {
    const mgr = new SessionManager();
    expect(mgr.cookieName).toBe('gbrain_session');
  });

  test('cleanup removes expired sessions', () => {
    const mgr = new SessionManager();
    const session = mgr.createSession({
      tenant_id: 't1',
      user_id: 'u1',
      user_email: 'u@t.com',
      user_name: 'U',
      idp_id: 'idp',
    });

    // Manually expire the session
    const internal = mgr as unknown as { sessions: Map<string, { expires_at: number }> };
    internal.sessions.get(session.session_id)!.expires_at = Date.now() - 1000;

    const removed = mgr.cleanup();
    expect(removed).toBe(1);
    expect(mgr.validate(session.session_id)).toBeUndefined();
  });

  test('session IDs are opaque and unpredictable', () => {
    const mgr = new SessionManager();
    const s1 = mgr.createSession({ tenant_id: 't', user_id: 'u', user_email: 'e', user_name: 'n', idp_id: 'i' });
    const s2 = mgr.createSession({ tenant_id: 't', user_id: 'u', user_email: 'e', user_name: 'n', idp_id: 'i' });

    expect(s1.session_id).not.toBe(s2.session_id);
    expect(s1.session_id.length).toBeGreaterThanOrEqual(40);
  });
});
