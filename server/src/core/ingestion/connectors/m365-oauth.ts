/**
 * Microsoft 365 OAuth2 helper — authorization code flow with PKCE for
 * Microsoft Graph API (OneDrive, SharePoint, Exchange).
 *
 * GBrain acts as an OAuth client against Microsoft identity platform.
 * Uses PKCE for security (no client_secret needed in the auth URL;
 * only at the token exchange step for confidential clients).
 *
 * Flow:
 *   1. generateAuthUrl(clientId, redirectUri, scopes, tenant) → URL + codeVerifier
 *   2. User opens URL in browser, approves consent
 *   3. Microsoft redirects to redirectUri with ?code=...&state=...
 *   4. exchangeCode(code, codeVerifier, clientId, clientSecret, redirectUri, tenant) → tokens
 *   5. Tokens stored in ~/.gbrain/connectors/m365.json
 *   6. M365Connector.refreshToken() handles automatic refresh
 *
 * Scopes (read-only):
 *   - Files.Read.All      (OneDrive/SharePoint files)
 *   - Mail.Read           (Exchange mail)
 *   - Calendars.Read      (Exchange calendars)
 *   - User.Read           (basic profile)
 *
 * Multi-tenant support:
 *   - tenant = 'common' allows any M365 tenant (default)
 *   - tenant = 'consumers' for personal Microsoft accounts
 *   - tenant = '<tenant-uuid>' for specific org tenant (recommended for enterprise)
 *
 * Reference: https://learn.microsoft.com/en-us/entra/identity-platform/
 */

import { randomBytes, createHash } from 'node:crypto';

const MS_AUTH_BASE = 'https://login.microsoftonline.com';
const MS_TOKEN_URL = (tenant: string) => `${MS_AUTH_BASE}/${tenant}/oauth2/v2.0/token`;
const MS_AUTH_URL = (tenant: string) => `${MS_AUTH_BASE}/${tenant}/oauth2/v2.0/authorize`;

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
  id_token?: string;
}

function randomBase64url(n: number): string {
  return randomBytes(n).toString('base64url');
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate the Microsoft OAuth2 authorization URL with PKCE.
 *
 * @param clientId     Application (client) ID from Azure AD app registration
 * @param redirectUri  Must match the URI registered in Azure AD
 * @param scopes       Space-separated OAuth scopes (e.g. "Files.Read.All Mail.Read")
 * @param tenant       'common', 'consumers', or specific tenant UUID
 * @returns            Auth URL + codeVerifier + state
 */
export function generateAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string,
  tenant: string = 'common',
): M365AuthUrl {
  const codeVerifier = randomBase64url(32);
  const codeChallenge = pkceChallenge(codeVerifier);
  const state = randomBase64url(16);

  const url = new URL(MS_AUTH_URL(tenant));
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  url.searchParams.set('response_mode', 'query');

  return { url: url.toString(), codeVerifier, state };
}

/**
 * Exchange the authorization code for tokens.
 *
 * @param code           The ?code=... from the redirect
 * @param codeVerifier   The verifier from generateAuthUrl
 * @param clientId       Application (client) ID
 * @param clientSecret   Application (client) secret (required for confidential clients)
 * @param redirectUri    Must match the URI used in generateAuthUrl
 * @param tenant         'common', 'consumers', or specific tenant UUID
 * @returns              Token response with access_token, refresh_token, expires_in
 */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tenant: string = 'common',
): Promise<M365TokenResponse> {
  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
    scope: 'offline_access',
  };

  if (clientSecret) {
    params.client_secret = clientSecret;
  }

  const res = await fetch(MS_TOKEN_URL(tenant), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`M365 token exchange failed (${res.status}): ${err}`);
  }

  return (await res.json()) as M365TokenResponse;
}

/**
 * Refresh an access token using the refresh token.
 *
 * @param refreshToken  The refresh_token from the initial exchange
 * @param clientId      Application (client) ID
 * @param clientSecret  Application (client) secret (required for confidential clients)
 * @param tenant        'common', 'consumers', or specific tenant UUID
 * @returns             New token response
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tenant: string = 'common',
): Promise<M365TokenResponse> {
  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    scope: 'offline_access',
  };

  if (clientSecret) {
    params.client_secret = clientSecret;
  }

  const res = await fetch(MS_TOKEN_URL(tenant), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`M365 token refresh failed (${res.status}): ${err}`);
  }

  return (await res.json()) as M365TokenResponse;
}

/**
 * Default scopes for M365 read-only ingest.
 * Files.Read.All  — OneDrive and SharePoint files
 * Mail.Read        — Exchange mail
 * Calendars.Read   — Exchange calendars
 * User.Read        — Basic profile (required for /me endpoint)
 * offline_access   — Required for refresh token
 */
export const M365_DEFAULT_SCOPES = 'Files.Read.All Mail.Read Calendars.Read User.Read offline_access';
