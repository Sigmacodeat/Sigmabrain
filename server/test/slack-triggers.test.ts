import { describe, test, expect, mock, beforeEach } from 'bun:test';
import {
  generateAuthUrl,
  exchangeCode,
  extractInstallation,
  SLACK_DEFAULT_SCOPES,
  type SlackOAuthResponse,
} from '../src/core/ingestion/connectors/slack-oauth.ts';
import {
  verifySlackSignature,
  processTrigger,
  WorkspaceRegistry,
} from '../src/core/ingestion/connectors/slack-triggers.ts';
import { createHmac } from 'node:crypto';

describe('Slack OAuth Helper', () => {
  test('generateAuthUrl produces valid URL with state', () => {
    const result = generateAuthUrl('test-client-id', 'http://localhost:3000/oauth/callback');

    expect(result.url).toContain('slack.com/oauth/v2/authorize');
    expect(result.url).toContain('client_id=test-client-id');
    expect(result.url).toContain('redirect_uri=');
    expect(result.url).toContain('state=');
    expect(result.state).toBeTruthy();
    expect(result.state.length).toBeGreaterThanOrEqual(32);
  });

  test('generateAuthUrl with custom scopes', () => {
    const result = generateAuthUrl('cid', 'http://localhost:3000/callback', 'channels:history,commands');

    expect(result.url).toContain('scope=channels%3Ahistory%2Ccommands');
  });

  test('SLACK_DEFAULT_SCOPES includes read and command scopes', () => {
    expect(SLACK_DEFAULT_SCOPES).toContain('channels:history');
    expect(SLACK_DEFAULT_SCOPES).toContain('groups:history');
    expect(SLACK_DEFAULT_SCOPES).toContain('commands');
    expect(SLACK_DEFAULT_SCOPES).toContain('chat:write');
  });

  test('exchangeCode throws on HTTP error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Server error', { status: 500 })),
    ) as unknown as typeof fetch;

    try {
      await expect(
        exchangeCode('code', 'cid', 'secret', 'http://localhost:3000/callback'),
      ).rejects.toThrow('Slack token exchange HTTP failed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('exchangeCode throws on API error (ok: false)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'invalid_code' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
    ) as unknown as typeof fetch;

    try {
      await expect(
        exchangeCode('bad-code', 'cid', 'secret', 'http://localhost:3000/callback'),
      ).rejects.toThrow('Slack token exchange API failed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('exchangeCode sends correct parameters', async () => {
    let capturedBody: string | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock((_url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) capturedBody = String(init.body);
      return Promise.resolve(new Response(JSON.stringify({
        ok: true,
        access_token: 'xoxb-test-token',
        token_type: 'bot',
        scope: 'channels:history,commands',
        bot_user_id: 'U123BOT',
        app_id: 'A123APP',
        team: { id: 'T123TEAM', name: 'Test Workspace' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }) as unknown as typeof fetch;

    try {
      const result = await exchangeCode('the-code', 'cid', 'secret', 'http://localhost:3000/callback');
      expect(result.ok).toBe(true);
      expect(result.access_token).toBe('xoxb-test-token');
      expect(result.team?.id).toBe('T123TEAM');
      expect(capturedBody).not.toBeNull();
      expect(capturedBody!).toContain('code=the-code');
      expect(capturedBody!).toContain('client_id=cid');
      expect(capturedBody!).toContain('client_secret=secret');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('extractInstallation throws when team id is missing', () => {
    const res: SlackOAuthResponse = {
      ok: true,
      access_token: 'xoxb-test',
      token_type: 'bot',
      scope: 'channels:history',
    };
    expect(() => extractInstallation(res)).toThrow('missing team id');
  });

  test('extractInstallation extracts workspace info correctly', () => {
    const res: SlackOAuthResponse = {
      ok: true,
      access_token: 'xoxb-test-token',
      token_type: 'bot',
      scope: 'channels:history,commands',
      bot_user_id: 'U123BOT',
      app_id: 'A123APP',
      team: { id: 'T123TEAM', name: 'My Workspace' },
    };

    const install = extractInstallation(res);
    expect(install.workspace_id).toBe('T123TEAM');
    expect(install.workspace_name).toBe('My Workspace');
    expect(install.bot_token).toBe('xoxb-test-token');
    expect(install.bot_user_id).toBe('U123BOT');
    expect(install.app_id).toBe('A123APP');
    expect(install.installed_at).toBeGreaterThan(0);
  });
});

describe('Slack Signature Verification', () => {
  const signingSecret = 'test-signing-secret';

  test('valid signature passes verification', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = 'team_id=T123&command=%2Fgbrain&text=hello&user_id=U456';
    const baseString = `v0:${timestamp}:${rawBody}`;
    const signature = createHmac('sha256', signingSecret).update(baseString).digest('hex');

    expect(verifySlackSignature(signingSecret, timestamp, signature, rawBody)).toBe(true);
  });

  test('invalid signature fails verification', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = 'team_id=T123&command=%2Fgbrain';
    const wrongSignature = '0'.repeat(64);

    expect(verifySlackSignature(signingSecret, timestamp, wrongSignature, rawBody)).toBe(false);
  });

  test('old timestamp fails verification (replay protection)', () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 min ago
    const rawBody = 'team_id=T123';
    const baseString = `v0:${oldTimestamp}:${rawBody}`;
    const signature = createHmac('sha256', signingSecret).update(baseString).digest('hex');

    expect(verifySlackSignature(signingSecret, oldTimestamp, signature, rawBody)).toBe(false);
  });

  test('wrong signing secret fails verification', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = 'team_id=T123';
    const baseString = `v0:${timestamp}:${rawBody}`;
    const signature = createHmac('sha256', 'wrong-secret').update(baseString).digest('hex');

    expect(verifySlackSignature(signingSecret, timestamp, signature, rawBody)).toBe(false);
  });
});

describe('Slack Trigger Processing', () => {
  let registry: WorkspaceRegistry;
  const signingSecret = 'test-signing-secret';

  beforeEach(() => {
    registry = new WorkspaceRegistry();
    registry.register({
      workspace_id: 'T123',
      workspace_name: 'Test Workspace',
      tenant_id: 'tenant-abc',
      bot_token: 'xoxb-test',
      signing_secret: signingSecret,
    });
  });

  function makeValidRequest(body: Record<string, string>): {
    body: Record<string, string>;
    headers: { 'x-slack-signature': string; 'x-slack-request-timestamp': string };
    rawBody: string;
  } {
    const rawBody = new URLSearchParams(body).toString();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const baseString = `v0:${timestamp}:${rawBody}`;
    const signature = createHmac('sha256', signingSecret).update(baseString).digest('hex');

    return {
      body,
      headers: {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp,
      },
      rawBody,
    };
  }

  test('approved trigger returns context with tenant mapping', () => {
    const req = makeValidRequest({
      team_id: 'T123',
      command: '/gbrain',
      text: 'search legal cases',
      user_id: 'U456',
      response_url: 'https://hooks.slack.com/commands/T123/12345',
    });

    const result = processTrigger(req.body, req.headers, req.rawBody, registry);

    expect(result.approved).toBe(true);
    expect(result.context).toBeDefined();
    expect(result.context!.workspace_id).toBe('T123');
    expect(result.context!.tenant_id).toBe('tenant-abc');
    expect(result.context!.command).toBe('gbrain');
    expect(result.context!.text).toBe('search legal cases');
    expect(result.context!.user_id).toBe('U456');
  });

  test('rejects trigger from unregistered workspace', () => {
    const rawBody = new URLSearchParams({
      team_id: 'T999',
      command: '/gbrain',
      text: 'test',
      user_id: 'U1',
    }).toString();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const baseString = `v0:${timestamp}:${rawBody}`;
    const signature = createHmac('sha256', 'other-secret').update(baseString).digest('hex');

    const result = processTrigger(
      { team_id: 'T999', command: '/gbrain', text: 'test', user_id: 'U1' },
      { 'x-slack-signature': signature, 'x-slack-request-timestamp': timestamp },
      rawBody,
      registry,
    );

    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Workspace not registered');
  });

  test('rejects trigger with invalid signature', () => {
    const result = processTrigger(
      { team_id: 'T123', command: '/gbrain', text: 'test', user_id: 'U456' },
      { 'x-slack-signature': '0'.repeat(64), 'x-slack-request-timestamp': String(Math.floor(Date.now() / 1000)) },
      'team_id=T123&command=/gbrain',
      registry,
    );

    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Invalid request signature');
  });

  test('rejects trigger with missing signature headers', () => {
    const result = processTrigger(
      { team_id: 'T123', command: '/gbrain', text: 'test', user_id: 'U456' },
      {},
      'team_id=T123',
      registry,
    );

    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Missing signature headers');
  });

  test('rejects trigger with missing team_id', () => {
    const result = processTrigger(
      { command: '/gbrain', text: 'test', user_id: 'U456' },
      { 'x-slack-signature': 'abc', 'x-slack-request-timestamp': '123' },
      'command=/gbrain',
      registry,
    );

    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Missing team_id in body');
  });

  test('rejects blocked user', () => {
    registry.register({
      workspace_id: 'T123',
      workspace_name: 'Test',
      tenant_id: 'tenant-abc',
      bot_token: 'xoxb',
      signing_secret: signingSecret,
      policy: { blocked_users: ['U_BAD'] },
    });

    const req = makeValidRequest({
      team_id: 'T123',
      command: '/gbrain',
      text: 'test',
      user_id: 'U_BAD',
    });

    const result = processTrigger(req.body, req.headers, req.rawBody, registry);
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('User blocked from triggers');
  });

  test('rejects disallowed command', () => {
    registry.register({
      workspace_id: 'T123',
      workspace_name: 'Test',
      tenant_id: 'tenant-abc',
      bot_token: 'xoxb',
      signing_secret: signingSecret,
      policy: { allowed_commands: ['search'] },
    });

    const req = makeValidRequest({
      team_id: 'T123',
      command: '/admin',
      text: 'delete all',
      user_id: 'U456',
    });

    const result = processTrigger(req.body, req.headers, req.rawBody, registry);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Command "admin" not allowed');
  });

  test('rejects when triggers disabled', () => {
    registry.register({
      workspace_id: 'T123',
      workspace_name: 'Test',
      tenant_id: 'tenant-abc',
      bot_token: 'xoxb',
      signing_secret: signingSecret,
      policy: { enabled: false },
    });

    const req = makeValidRequest({
      team_id: 'T123',
      command: '/gbrain',
      text: 'search',
      user_id: 'U456',
    });

    const result = processTrigger(req.body, req.headers, req.rawBody, registry);
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Triggers disabled for this workspace');
  });

  test('rejects when rate limit exceeded', () => {
    // Use unique workspace ID to avoid rate limiter state from other tests
    registry.register({
      workspace_id: 'T_RATE',
      workspace_name: 'Rate Test',
      tenant_id: 'tenant-rate',
      bot_token: 'xoxb',
      signing_secret: signingSecret,
      policy: { rate_limit_per_hour: 2 },
    });

    // First two should pass
    for (let i = 0; i < 2; i++) {
      const rawBody = new URLSearchParams({
        team_id: 'T_RATE',
        command: '/gbrain',
        text: 'search',
        user_id: 'U456',
      }).toString();
      const timestamp = String(Math.floor(Date.now() / 1000));
      const baseString = `v0:${timestamp}:${rawBody}`;
      const signature = createHmac('sha256', signingSecret).update(baseString).digest('hex');

      const result = processTrigger(
        { team_id: 'T_RATE', command: '/gbrain', text: 'search', user_id: 'U456' },
        { 'x-slack-signature': signature, 'x-slack-request-timestamp': timestamp },
        rawBody,
        registry,
      );
      expect(result.approved).toBe(true);
    }

    // Third should be rate limited
    const rawBody = new URLSearchParams({
      team_id: 'T_RATE',
      command: '/gbrain',
      text: 'search',
      user_id: 'U456',
    }).toString();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const baseString = `v0:${timestamp}:${rawBody}`;
    const signature = createHmac('sha256', signingSecret).update(baseString).digest('hex');

    const result = processTrigger(
      { team_id: 'T_RATE', command: '/gbrain', text: 'search', user_id: 'U456' },
      { 'x-slack-signature': signature, 'x-slack-request-timestamp': timestamp },
      rawBody,
      registry,
    );
    expect(result.approved).toBe(false);
    expect(result.reason).toBe('Rate limit exceeded');
  });
});

describe('WorkspaceRegistry', () => {
  test('register and get workspace', () => {
    const reg = new WorkspaceRegistry();
    reg.register({
      workspace_id: 'T1',
      workspace_name: 'My Team',
      tenant_id: 'tenant-1',
      bot_token: 'xoxb-1',
      signing_secret: 'secret',
    });

    const ws = reg.get('T1');
    expect(ws).toBeDefined();
    expect(ws!.workspace_name).toBe('My Team');
    expect(ws!.tenant_id).toBe('tenant-1');
    expect(ws!.policy.enabled).toBe(true);
    expect(ws!.policy.allowed_commands).toContain('search');
  });

  test('unregister removes workspace', () => {
    const reg = new WorkspaceRegistry();
    reg.register({
      workspace_id: 'T1',
      workspace_name: 'My Team',
      tenant_id: 'tenant-1',
      bot_token: 'xoxb-1',
      signing_secret: 'secret',
    });

    expect(reg.isRegistered('T1')).toBe(true);
    reg.unregister('T1');
    expect(reg.isRegistered('T1')).toBe(false);
    expect(reg.get('T1')).toBeUndefined();
  });

  test('list returns all workspaces', () => {
    const reg = new WorkspaceRegistry();
    reg.register({ workspace_id: 'T1', workspace_name: 'A', tenant_id: 't1', bot_token: 'x', signing_secret: 's' });
    reg.register({ workspace_id: 'T2', workspace_name: 'B', tenant_id: 't2', bot_token: 'x', signing_secret: 's' });

    const list = reg.list();
    expect(list).toHaveLength(2);
    expect(list.map((w) => w.workspace_id)).toContain('T1');
    expect(list.map((w) => w.workspace_id)).toContain('T2');
  });

  test('get returns undefined for unregistered workspace', () => {
    const reg = new WorkspaceRegistry();
    expect(reg.get('NONEXIST')).toBeUndefined();
    expect(reg.isRegistered('NONEXIST')).toBe(false);
  });
});
