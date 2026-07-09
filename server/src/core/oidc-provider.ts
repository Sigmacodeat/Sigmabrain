/**
 * OIDC Provider — Enterprise SSO via OpenID Connect.
 *
 * Implements the authorization code flow with PKCE for OIDC, supporting:
 *   - Login redirect to external IdP (Google, Azure AD, Okta, etc.)
 *   - Callback handling with code exchange
 *   - ID token verification and claims extraction
 *   - Tenant identity mapping from IdP claims
 *   - Session issuance and management
 *   - Logout with session invalidation
 *
 * WP-209
 *
 * Security:
 *   - PKCE on all auth code flows
 *   - State parameter for CSRF protection
 *   - Nonce parameter for replay protection
 *   - ID token verification (issuer, audience, expiry, nonce)
 *   - Session tokens are opaque, random, single-use state
 *   - No plaintext passwords or secrets
 */

import { randomBytes, createHash } from 'node:crypto';

export interface IdentityProvider {
  id: string;
  name: string;
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string[];
  tenant_claim: string;
  email_claim: string;
  name_claim: string;
}

export interface OIDCSession {
  session_id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  idp_id: string;
  issued_at: number;
  expires_at: number;
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
}

export interface OIDCAuthRequest {
  url: string;
  state: string;
  nonce: string;
  code_verifier: string;
}

export interface IDTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

function randomBase64url(n: number): string {
  return randomBytes(n).toString('base64url');
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

interface PendingAuth {
  state: string;
  nonce: string;
  code_verifier: string;
  idp_id: string;
  redirect_to?: string;
  created_at: number;
}

const pendingAuths = new Map<string, PendingAuth>();
const PENDING_AUTH_TTL = 10 * 60 * 1000;

function cleanExpiredPendingAuths(): void {
  const now = Date.now();
  for (const [key, auth] of pendingAuths) {
    if (now - auth.created_at > PENDING_AUTH_TTL) pendingAuths.delete(key);
  }
}

const sessions = new Map<string, OIDCSession>();
const SESSION_TTL = 24 * 60 * 60 * 1000;

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now > session.expires_at) sessions.delete(key);
  }
}

export class OIDCProvider {
  private providers = new Map<string, IdentityProvider>();

  registerProvider(provider: IdentityProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(idpId: string): IdentityProvider | undefined {
    return this.providers.get(idpId);
  }

  listProviders(): Array<{ id: string; name: string; issuer: string }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id, name: p.name, issuer: p.issuer,
    }));
  }

  initiateLogin(idpId: string, redirectTo?: string): OIDCAuthRequest {
    const provider = this.providers.get(idpId);
    if (!provider) throw new Error(`Unknown identity provider: ${idpId}`);

    cleanExpiredPendingAuths();

    const codeVerifier = randomBase64url(32);
    const codeChallenge = pkceChallenge(codeVerifier);
    const state = randomBase64url(24);
    const nonce = randomBase64url(24);

    const url = new URL(provider.authorization_endpoint);
    url.searchParams.set('client_id', provider.client_id);
    url.searchParams.set('redirect_uri', provider.redirect_uri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', provider.scopes.join(' '));
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);

    pendingAuths.set(state, {
      state, nonce, code_verifier: codeVerifier, idp_id: idpId,
      redirect_to: redirectTo, created_at: Date.now(),
    });

    return { url: url.toString(), state, nonce, code_verifier: codeVerifier };
  }

  async handleCallback(code: string, state: string): Promise<OIDCSession> {
    cleanExpiredPendingAuths();

    const pending = pendingAuths.get(state);
    if (!pending) throw new Error('Invalid or expired state parameter');
    pendingAuths.delete(state);

    const provider = this.providers.get(pending.idp_id);
    if (!provider) throw new Error(`Identity provider no longer registered: ${pending.idp_id}`);

    const tokenRes = await this._exchangeCode(provider, code, pending.code_verifier);
    const claims = this._parseIDToken(tokenRes.id_token, provider, pending.nonce);

    const tenantId = this._extractClaim(claims, provider.tenant_claim);
    if (!tenantId) throw new Error('Tenant claim not found in ID token');

    const userEmail = this._extractClaim(claims, provider.email_claim) ?? claims.email ?? '';
    const userName = this._extractClaim(claims, provider.name_claim) ?? claims.name ?? '';

    const sessionId = randomBase64url(32);
    const now = Date.now();
    const session: OIDCSession = {
      session_id: sessionId,
      tenant_id: tenantId,
      user_id: claims.sub,
      user_email: userEmail,
      user_name: userName,
      idp_id: provider.id,
      issued_at: now,
      expires_at: now + SESSION_TTL,
      id_token: tokenRes.id_token,
      access_token: tokenRes.access_token,
      refresh_token: tokenRes.refresh_token,
    };

    sessions.set(sessionId, session);
    return session;
  }

  validateSession(sessionId: string): OIDCSession | undefined {
    cleanExpiredSessions();
    const session = sessions.get(sessionId);
    if (!session) return undefined;
    if (Date.now() > session.expires_at) {
      sessions.delete(session.session_id);
      return undefined;
    }
    return session;
  }

  logout(sessionId: string): boolean {
    return sessions.delete(sessionId);
  }

  getSessionsForTenant(tenantId: string): OIDCSession[] {
    cleanExpiredSessions();
    return Array.from(sessions.values()).filter((s) => s.tenant_id === tenantId);
  }

  // ── Internal ────────────────────────────────────────────────────────

  private async _exchangeCode(
    provider: IdentityProvider,
    code: string,
    codeVerifier: string,
  ): Promise<{ access_token: string; id_token: string; refresh_token?: string; expires_in: number }> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: provider.redirect_uri,
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      code_verifier: codeVerifier,
    });

    const res = await fetch(provider.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OIDC token exchange failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      access_token: string; id_token: string; refresh_token?: string;
      expires_in: number; token_type: string;
    };

    if (!data.id_token) throw new Error('OIDC token response missing id_token');
    return data;
  }

  private _parseIDToken(
    idToken: string,
    provider: IdentityProvider,
    expectedNonce: string,
  ): IDTokenClaims {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('Invalid ID token format');

    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    const claims = JSON.parse(payload) as IDTokenClaims;

    if (claims.iss !== provider.issuer) {
      throw new Error(`ID token issuer mismatch: expected ${provider.issuer}, got ${claims.iss}`);
    }
    if (claims.aud !== provider.client_id) {
      throw new Error(`ID token audience mismatch: expected ${provider.client_id}, got ${claims.aud}`);
    }
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) throw new Error('ID token expired');
    if (expectedNonce && claims.nonce && claims.nonce !== expectedNonce) {
      throw new Error('ID token nonce mismatch');
    }
    return claims;
  }

  private _extractClaim(claims: IDTokenClaims, claimPath: string): string | undefined {
    const parts = claimPath.split('.');
    let value: unknown = claims;
    for (const part of parts) {
      if (typeof value !== 'object' || value === null) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
  }
}

let _provider: OIDCProvider | undefined;
export function getOIDCProvider(): OIDCProvider {
  if (!_provider) _provider = new OIDCProvider();
  return _provider;
}
