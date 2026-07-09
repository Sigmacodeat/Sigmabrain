/**
 * Microsoft 365 OAuth2 helper — PKCE flow for Microsoft Graph API.
 *
 * Implements the OAuth2 Authorization Code Flow with PKCE for
 * Microsoft identity platform (Azure AD / Entra ID).
 *
 * Flow:
 *   1. generateAuthUrl(clientId, redirectUri, scopes, tenant) → URL + verifier + state
 *   2. User opens URL, consents permissions
 *   3. Microsoft redirects to redirectUri with ?code=...&state=...
 *   4. exchangeCode(code, verifier, clientId, secret, redirectUri, tenant) → tokens
 *   5. Tokens stored in ~/.gbrain/connectors/m365.json
 *   6. refreshAccessToken(refreshToken, clientId, secret, tenant) → new tokens
 *
 * Scopes (read-only):
 *   Files.Read.All   — OneDrive/SharePoint files
 *   Mail.Read         — Exchange mail
 *   Calendars.Read    — Exchange calendar
 *   User.Read         — basic profile
 *   offline_access    — refresh token
 *
 * Tenant:
 *   'common'     — multi-tenant (any Azure AD org + personal MSAs)
 *   'consumers'  — personal Microsoft accounts only
 *   <tenant-uuid> — specific Azure AD tenant (enterprise isolation)
 *
 * Reference: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 */

import { randomBytes, createHash } from 'node:crypto';

export const M365_DEFAULT_SCOPES = [
  'Files.Read.All',
  'Mail.Read',
  'Calendars.Read',
  'User.Read',
  'offline_access',
].join(' ');

export interface M365AuthUrl {
  url: string;
  codeVerifier: string;
  state: string;
}

export interface M365TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

function randomBase64url(n: number): string {
  return randomBytes(n).toString('base64url');
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function tenantAuthority(tenant: string): string {
  return `https://login.microsoftonline.com/${tenant}`;
}

export function generateAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string = M365_DEFAULT_SCOPES,
  tenant: string = 'common',
): M365AuthUrl {
  const codeVerifier = randomBase64url(32);
  const codeChallenge = pkceChallenge(codeVerifier);
  const state = randomBase64url(16);

  const url = new URL(`${tenantAuthority(tenant)}/oauth2/v2.0/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  return { url: url.toString(), codeVerifier, state };
}

export async function exchangeCode(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tenant: string = 'common',
): Promise<M365TokenResponse> {
  const tokenUrl = `${tenantAuthority(tenant)}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
      scope: M365_DEFAULT_SCOPES,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`M365 token exchange failed (${res.status}): ${err}`);
  }

  return (await res.json()) as M365TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tenant: string = 'common',
): Promise<M365TokenResponse> {
  const tokenUrl = `${tenantAuthority(tenant)}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: M365_DEFAULT_SCOPES,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`M365 token refresh failed (${res.status}): ${err}`);
  }

  return (await res.json()) as M365TokenResponse;
}
