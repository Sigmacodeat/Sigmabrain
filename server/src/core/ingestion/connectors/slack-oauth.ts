/**
 * Slack OAuth2 helper — Slack App installation flow.
 *
 * Slack uses a standard OAuth2 authorization code flow (no PKCE needed).
 * The app is installed per-workspace, yielding a bot token (xoxb-).
 *
 * Flow:
 *   1. generateAuthUrl(clientId, redirectUri, scopes) → URL + state
 *   2. User opens URL, approves app installation in their Slack workspace
 *   3. Slack redirects to redirectUri with ?code=...&state=...
 *   4. exchangeCode(code, clientId, clientSecret, redirectUri) → tokens + workspace info
 *   5. Tokens + workspace mapping stored in ~/.gbrain/connectors/slack.json
 *
 * Scopes (read-only ingest + trigger relay):
 *   channels:history, groups:history, im:history, mpim:history
 *   channels:read, groups:read
 *   commands (slash command trigger relay)
 *   chat:write (trigger response messages only)
 *
 * Reference: https://api.slack.com/authentication/oauth-v2
 */

import { randomBytes } from 'node:crypto';

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

export interface SlackAuthUrl {
  url: string;
  state: string;
}

export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id: string; name: string };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  error?: string;
}

export const SLACK_DEFAULT_SCOPES = [
  'channels:history',
  'groups:history',
  'im:history',
  'mpim:history',
  'channels:read',
  'groups:read',
  'commands',
  'chat:write',
].join(',');

export function generateAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string = SLACK_DEFAULT_SCOPES,
): SlackAuthUrl {
  const state = randomBytes(16).toString('hex');
  const url = new URL(SLACK_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<SlackOAuthResponse> {
  const res = await fetch(SLACK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Slack token exchange HTTP failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok) {
    throw new Error(`Slack token exchange API failed: ${data.error ?? 'unknown error'}`);
  }
  return data;
}

export interface SlackWorkspaceInstallation {
  workspace_id: string;
  workspace_name: string;
  bot_token: string;
  bot_user_id: string;
  app_id: string;
  installed_at: number;
  scopes: string;
}

export function extractInstallation(res: SlackOAuthResponse): SlackWorkspaceInstallation {
  if (!res.team?.id) throw new Error('Slack OAuth response missing team id');
  return {
    workspace_id: res.team.id,
    workspace_name: res.team.name,
    bot_token: res.access_token,
    bot_user_id: res.bot_user_id ?? '',
    app_id: res.app_id ?? '',
    installed_at: Date.now(),
    scopes: res.scope,
  };
}
