import { describe, test, expect, mock } from 'bun:test';

// Tests use direct _state assignment instead of file-based state loading
// to avoid homedir() caching issues across test runs.

describe('M365 OAuth Helper', () => {
  test('generateAuthUrl produces valid URL with PKCE', async () => {
    const { generateAuthUrl, M365_DEFAULT_SCOPES } = await import('../src/core/ingestion/connectors/m365-oauth.ts');

    const result = generateAuthUrl(
      'test-client-id',
      'http://localhost:3000/oauth/callback',
      M365_DEFAULT_SCOPES,
      'common',
    );

    expect(result.url).toContain('login.microsoftonline.com');
    expect(result.url).toContain('client_id=test-client-id');
    expect(result.url).toContain('response_type=code');
    expect(result.url).toContain('code_challenge_method=S256');
    expect(result.url).toContain('code_challenge=');
    expect(result.state).toBeTruthy();
    expect(result.codeVerifier).toBeTruthy();
    expect(result.url).toContain('state=');
  });

  test('generateAuthUrl with specific tenant', async () => {
    const { generateAuthUrl } = await import('../src/core/ingestion/connectors/m365-oauth.ts');

    const result = generateAuthUrl(
      'test-client-id',
      'http://localhost:3000/oauth/callback',
      'Files.Read.All',
      '11111111-2222-3333-4444-555555555555',
    );

    expect(result.url).toContain('11111111-2222-3333-4444-555555555555');
  });

  test('M365_DEFAULT_SCOPES includes read-only scopes', async () => {
    const { M365_DEFAULT_SCOPES } = await import('../src/core/ingestion/connectors/m365-oauth.ts');

    expect(M365_DEFAULT_SCOPES).toContain('Files.Read.All');
    expect(M365_DEFAULT_SCOPES).toContain('Mail.Read');
    expect(M365_DEFAULT_SCOPES).toContain('Calendars.Read');
    expect(M365_DEFAULT_SCOPES).toContain('offline_access');
    // No write scopes
    expect(M365_DEFAULT_SCOPES).not.toContain('Files.ReadWrite');
    expect(M365_DEFAULT_SCOPES).not.toContain('Mail.Send');
  });

  test('exchangeCode throws on non-ok response', async () => {
    const { exchangeCode } = await import('../src/core/ingestion/connectors/m365-oauth.ts');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{"error":"invalid_grant"}', { status: 400 })),
    ) as unknown as typeof fetch;

    try {
      await expect(
        exchangeCode('code', 'verifier', 'client-id', 'secret', 'http://localhost:3000/callback', 'common'),
      ).rejects.toThrow('M365 token exchange failed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('refreshAccessToken throws on non-ok response', async () => {
    const { refreshAccessToken } = await import('../src/core/ingestion/connectors/m365-oauth.ts');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{"error":"invalid_grant"}', { status: 400 })),
    ) as unknown as typeof fetch;

    try {
      await expect(
        refreshAccessToken('rt', 'client-id', 'secret', 'common'),
      ).rejects.toThrow('M365 token refresh failed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('exchangeCode sends correct parameters', async () => {
    const { exchangeCode } = await import('../src/core/ingestion/connectors/m365-oauth.ts');

    let capturedBody: string | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) capturedBody = String(init.body);
      return Promise.resolve(
        new Response(JSON.stringify({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'Files.Read.All',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }) as unknown as typeof fetch;

    try {
      const result = await exchangeCode('the-code', 'the-verifier', 'cid', 'secret', 'http://localhost:3000/callback', 'common');
      expect(result.access_token).toBe('at');
      expect(result.refresh_token).toBe('rt');
      expect(capturedBody).not.toBeNull();
      expect(capturedBody!).toContain('grant_type=authorization_code');
      expect(capturedBody!).toContain('code=the-code');
      expect(capturedBody!).toContain('client_id=cid');
      expect(capturedBody!).toContain('code_verifier=the-verifier');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('M365Connector', () => {
  test('constructs with default tenant', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({ client_id: 'cid', client_secret: 'cs' });
    expect(connector.id).toBe('m365');
    expect(connector.kind).toBe('connector:m365');
  });

  test('constructs with specific tenant and sources', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({
      client_id: 'cid',
      client_secret: 'cs',
      tenant: 'my-tenant-id',
      sources: ['files'],
    });
    expect(connector.id).toBe('m365');
  });

  test('getApiRateLimit returns Graph API limits', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({});
    const limit = connector.getApiRateLimit();
    expect(limit.capacity).toBeGreaterThan(0);
    expect(limit.windowMs).toBeGreaterThan(0);
  });

  test('fetchDelta throws when not authenticated', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({});

    await expect(connector.fetchDelta()).rejects.toThrow('Not authenticated');
  });

  test('fetchDelta fetches files, mail, and calendar with mocked Graph API', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({ client_id: 'cid', client_secret: 'cs' });

    // Set state directly (normally done by start()/sync() via file loading)
    (connector as any)._state = {
      connector_id: 'm365',
      service: 'm365',
      access_token: 'test-at',
      refresh_token: 'test-rt',
      token_expires_at: Date.now() + 3600_000,
    };

    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = mock((url: string | URL | Request) => {
      callCount++;
      const urlStr = url.toString();

      if (urlStr.includes('/me/drive/root/delta')) {
        return Promise.resolve(new Response(JSON.stringify({
          value: [
            {
              id: 'file-1',
              name: 'document.docx',
              lastModifiedDateTime: '2026-01-01T00:00:00Z',
              webUrl: 'https://my.sharepoint.com/document.docx',
              file: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
              parentReference: { driveId: 'drive-1' },
            },
            {
              id: 'folder-1',
              name: 'My Folder',
              lastModifiedDateTime: '2026-01-01T00:00:00Z',
              folder: { childCount: 5 },
            },
          ],
          '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=abc123',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }

      if (urlStr.includes('/me/messages')) {
        return Promise.resolve(new Response(JSON.stringify({
          value: [
            {
              id: 'msg-1',
              subject: 'Test Email',
              body: { content: '<p>Hello World</p>', contentType: 'HTML' },
              receivedDateTime: '2026-01-01T10:00:00Z',
              webLink: 'https://outlook.live.com/mail/1',
              from: { emailAddress: { address: 'test@example.com', name: 'Test User' } },
            },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }

      if (urlStr.includes('/me/events')) {
        return Promise.resolve(new Response(JSON.stringify({
          value: [
            {
              id: 'evt-1',
              subject: 'Team Meeting',
              body: { content: 'Weekly sync', contentType: 'Text' },
              start: { dateTime: '2026-01-05T09:00:00Z' },
              end: { dateTime: '2026-01-05T10:00:00Z' },
              webLink: 'https://outlook.live.com/calendar/1',
              location: { displayName: 'Conference Room A' },
            },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }

      return Promise.resolve(new Response('Not found', { status: 404 }));
    }) as unknown as typeof fetch;

    try {
      const result = await connector.fetchDelta();

      // Should have 1 file (folder skipped), 1 mail, 1 calendar event
      expect(result.items.length).toBe(3);
      expect(callCount).toBe(3);

      // Verify file item
      const fileItem = result.items.find(i => i.metadata?.source_type === 'file');
      expect(fileItem).toBeDefined();
      expect(fileItem!.title).toBe('document.docx');
      expect(fileItem!.metadata?.mime_type).toContain('wordprocessingml');

      // Verify mail item
      const mailItem = result.items.find(i => i.metadata?.source_type === 'mail');
      expect(mailItem).toBeDefined();
      expect(mailItem!.title).toBe('Test Email');
      expect(mailItem!.metadata?.from_address).toBe('test@example.com');

      // Verify calendar item
      const calItem = result.items.find(i => i.metadata?.source_type === 'calendar');
      expect(calItem).toBeDefined();
      expect(calItem!.title).toBe('Team Meeting');
      expect(calItem!.metadata?.location).toBe('Conference Room A');

      // Cursor should contain delta link for files
      expect(result.nextCursor).toContain('files:');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fetchDelta with sources=files only fetches files', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({
      client_id: 'cid',
      client_secret: 'cs',
      sources: ['files'],
    });

    (connector as any)._state = {
      connector_id: 'm365',
      service: 'm365',
      access_token: 'test-at',
      refresh_token: 'test-rt',
      token_expires_at: Date.now() + 3600_000,
    };

    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = mock((url: string | URL | Request) => {
      callCount++;
      const urlStr = url.toString();
      if (urlStr.includes('/me/drive/root/delta')) {
        return Promise.resolve(new Response(JSON.stringify({
          value: [{
            id: 'f1', name: 'test.txt', lastModifiedDateTime: '2026-01-01T00:00:00Z',
            file: { mimeType: 'text/plain' },
          }],
          '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=xyz',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    try {
      const result = await connector.fetchDelta();
      expect(result.items.length).toBe(1);
      expect(callCount).toBe(1); // Only files API called
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fetchDelta handles Graph API error', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({
      client_id: 'cid',
      client_secret: 'cs',
      sources: ['files'],
    });

    (connector as any)._state = {
      connector_id: 'm365',
      service: 'm365',
      access_token: 'test-at',
      token_expires_at: Date.now() + 3600_000,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{"error":{"code":"TokenExpired"}}', { status: 401 })),
    ) as unknown as typeof fetch;

    try {
      await expect(connector.fetchDelta()).rejects.toThrow('M365 files delta failed');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('toIngestionEvent produces correct event shape for mail', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({ client_id: 'cid', client_secret: 'cs' });

    (connector as any)._state = {
      connector_id: 'm365',
      service: 'm365',
      access_token: 'test-at',
      token_expires_at: Date.now() + 3600_000,
    };

    const event = await connector.toIngestionEvent({
      id: 'msg-1',
      title: 'Test Email',
      modified_at: '2026-01-01T10:00:00Z',
      content: '<p>Hello</p>',
      content_type: 'text/html',
      url: 'https://outlook.live.com/mail/1',
      metadata: { source_type: 'mail', from_address: 'a@b.com' },
    });

    expect(event.source_id).toBe('m365');
    expect(event.source_kind).toBe('connector:m365');
    expect(event.content).toBe('<p>Hello</p>');
    expect(event.metadata?.connector).toBe('m365');
    expect(event.metadata?.tenant).toBe('common');
    expect(event.metadata?.m365_item_id).toBe('msg-1');
    expect(event.content_hash).toBeTruthy();
  });

  test('composite cursor round-trips correctly', async () => {
    const { M365Connector } = await import('../src/core/ingestion/connectors/m365.ts');
    const connector = new M365Connector({
      client_id: 'cid',
      client_secret: 'cs',
      sources: ['files', 'mail'],
    });

    (connector as any)._state = {
      connector_id: 'm365',
      service: 'm365',
      access_token: 'test-at',
      token_expires_at: Date.now() + 3600_000,
    };

    let filesUrl: string | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/me/drive/root/delta')) {
        filesUrl = urlStr;
        return Promise.resolve(new Response(JSON.stringify({
          value: [],
          '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=files-token',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (urlStr.includes('/me/messages')) {
        return Promise.resolve(new Response(JSON.stringify({
          value: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    try {
      // First sync — no cursor
      const result1 = await connector.fetchDelta();
      expect(result1.nextCursor).toContain('files:');

      // Second sync — pass cursor back
      const result2 = await connector.fetchDelta(result1.nextCursor);
      // filesUrl should now be the delta link from first sync
      expect(filesUrl).not.toBeNull();
      expect(filesUrl!).toContain('token=files-token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
