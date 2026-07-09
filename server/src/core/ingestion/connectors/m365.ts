/**
 * M365Connector — ingest OneDrive/SharePoint files, Exchange mail, and
 * Calendar events via Microsoft Graph API.
 *
 * Authentication: OAuth2 PKCE flow (m365-oauth.ts)
 * Delta sync:
 *   - Files: Graph API delta endpoint with @odata.deltaLink
 *   - Mail: Graph API messages with skip-based pagination
 *   - Calendar: Graph API events with skip-based pagination
 * Composite cursor: files:<deltaLink>|mail:<skip>|calendar:<skip>
 * Rate limit: Graph API — 10 req/sec (conservative), burst 10.
 *
 * WP-206
 */

import {
  BaseConnector,
  type ConnectorConfig,
  type ConnectorItem,
} from './base.ts';
import { type IngestionEvent, type IngestionContentType } from '../types.ts';
import { refreshAccessToken } from './m365-oauth.ts';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

interface M365Config extends ConnectorConfig {
  tenant?: string;
  sources?: string[];
}

export class M365Connector extends BaseConnector {
  private _tenant: string;
  private _sources: string[];

  constructor(config: M365Config = {}) {
    super('m365', config);
    this._tenant = (config.tenant as string) ?? 'common';
    this._sources = (config.sources as string[]) ?? ['files', 'mail', 'calendar'];
  }

  getApiRateLimit() {
    return { capacity: 10, windowMs: 1000 };
  }

  async refreshToken(): Promise<void> {
    if (!this._state?.refresh_token) return;
    const res = await refreshAccessToken(
      this._state.refresh_token,
      this._config.client_id!,
      this._config.client_secret!,
      this._tenant,
    );
    this.updateTokens(res.access_token, res.refresh_token ?? this._state.refresh_token, res.expires_in);
  }

  async fetchDelta(cursor?: string): Promise<{ items: ConnectorItem[]; nextCursor?: string }> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const cursors = this._parseCursor(cursor);
    const items: ConnectorItem[] = [];

    if (this._sources.includes('files')) {
      const fileItems = await this._fetchFilesDelta(token, cursors.files);
      items.push(...fileItems.items);
      if (fileItems.deltaLink) cursors.files = fileItems.deltaLink;
    }

    if (this._sources.includes('mail')) {
      const mailItems = await this._fetchMailDelta(token, cursors.mail);
      items.push(...mailItems.items);
      if (mailItems.nextSkip) cursors.mail = mailItems.nextSkip;
    }

    if (this._sources.includes('calendar')) {
      const calItems = await this._fetchCalendarDelta(token, cursors.calendar);
      items.push(...calItems.items);
      if (calItems.nextSkip) cursors.calendar = calItems.nextSkip;
    }

    const nextCursor = this._buildCursor(cursors);
    return { items, nextCursor };
  }

  async toIngestionEvent(item: ConnectorItem): Promise<IngestionEvent> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const contentType = this.detectContentType(item.title, item.content_type) as IngestionContentType;
    return {
      source_id: this.id,
      source_kind: this.kind,
      source_uri: item.url ?? `m365://${item.id}`,
      received_at: new Date().toISOString(),
      content_type: contentType,
      content: item.content,
      content_hash: this.hashContent(item.content),
      metadata: {
        ...item.metadata,
        connector: 'm365',
        tenant: this._tenant,
        m365_item_id: item.id,
      },
    };
  }

  // ── Cursor helpers ──────────────────────────────────────────────────

  private _parseCursor(cursor?: string): Record<string, string> {
    if (!cursor) return {};
    const parts: Record<string, string> = {};
    for (const segment of cursor.split('|')) {
      const [key, ...rest] = segment.split(':');
      if (key && rest.length > 0) parts[key] = rest.join(':');
    }
    return parts;
  }

  private _buildCursor(cursors: Record<string, string>): string {
    return Object.entries(cursors)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
  }

  // ── Files (OneDrive/SharePoint) ─────────────────────────────────────

  private async _fetchFilesDelta(
    token: string,
    deltaLink?: string,
  ): Promise<{ items: ConnectorItem[]; deltaLink?: string }> {
    const url = deltaLink ?? `${GRAPH_BASE}/me/drive/root/delta`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`M365 files delta failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        lastModifiedDateTime: string;
        webUrl?: string;
        file?: { mimeType: string };
        folder?: { childCount: number };
        parentReference?: { driveId: string };
      }>;
      '@odata.deltaLink'?: string;
    };

    const items: ConnectorItem[] = [];
    for (const item of data.value ?? []) {
      if (item.folder) continue; // Skip folders
      items.push({
        id: item.id,
        title: item.name,
        modified_at: item.lastModifiedDateTime,
        content: item.webUrl ?? '',
        content_type: item.file?.mimeType ?? 'application/octet-stream',
        url: item.webUrl,
        metadata: {
          source_type: 'file',
          mime_type: item.file?.mimeType,
          drive_id: item.parentReference?.driveId,
        },
      });
    }

    return { items, deltaLink: data['@odata.deltaLink'] };
  }

  // ── Mail (Exchange) ─────────────────────────────────────────────────

  private async _fetchMailDelta(
    token: string,
    skip?: string,
  ): Promise<{ items: ConnectorItem[]; nextSkip?: string }> {
    const url = new URL(`${GRAPH_BASE}/me/messages`);
    url.searchParams.set('$top', '50');
    url.searchParams.set('$select', 'id,subject,body,receivedDateTime,webLink,from');
    url.searchParams.set('$orderby', 'receivedDateTime desc');
    if (skip) url.searchParams.set('$skip', skip);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`M365 mail delta failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        subject: string;
        body?: { content: string; contentType: string };
        receivedDateTime: string;
        webLink?: string;
        from?: { emailAddress?: { address: string; name: string } };
      }>;
      '@odata.nextLink'?: string;
    };

    const items: ConnectorItem[] = [];
    for (const msg of data.value ?? []) {
      items.push({
        id: msg.id,
        title: msg.subject ?? '(no subject)',
        modified_at: msg.receivedDateTime,
        content: msg.body?.content ?? '',
        content_type: msg.body?.contentType === 'HTML' ? 'text/html' : 'text/plain',
        url: msg.webLink,
        metadata: {
          source_type: 'mail',
          from_address: msg.from?.emailAddress?.address,
          from_name: msg.from?.emailAddress?.name,
        },
      });
    }

    // Extract skip token from nextLink if present
    let nextSkip: string | undefined;
    if (data['@odata.nextLink']) {
      const nextUrl = new URL(data['@odata.nextLink']);
      nextSkip = nextUrl.searchParams.get('$skip') ?? undefined;
    }

    return { items, nextSkip };
  }

  // ── Calendar (Exchange) ─────────────────────────────────────────────

  private async _fetchCalendarDelta(
    token: string,
    skip?: string,
  ): Promise<{ items: ConnectorItem[]; nextSkip?: string }> {
    const url = new URL(`${GRAPH_BASE}/me/events`);
    url.searchParams.set('$top', '50');
    url.searchParams.set('$select', 'id,subject,body,start,end,webLink,location');
    url.searchParams.set('$orderby', 'start/dateTime desc');
    if (skip) url.searchParams.set('$skip', skip);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`M365 calendar delta failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        subject: string;
        body?: { content: string; contentType: string };
        start?: { dateTime: string };
        end?: { dateTime: string };
        webLink?: string;
        location?: { displayName: string };
      }>;
      '@odata.nextLink'?: string;
    };

    const items: ConnectorItem[] = [];
    for (const evt of data.value ?? []) {
      items.push({
        id: evt.id,
        title: evt.subject ?? '(no title)',
        modified_at: evt.start?.dateTime ?? new Date().toISOString(),
        content: evt.body?.content ?? '',
        content_type: evt.body?.contentType === 'HTML' ? 'text/html' : 'text/plain',
        url: evt.webLink,
        metadata: {
          source_type: 'calendar',
          start: evt.start?.dateTime,
          end: evt.end?.dateTime,
          location: evt.location?.displayName,
        },
      });
    }

    let nextSkip: string | undefined;
    if (data['@odata.nextLink']) {
      const nextUrl = new URL(data['@odata.nextLink']);
      nextSkip = nextUrl.searchParams.get('$skip') ?? undefined;
    }

    return { items, nextSkip };
  }
}
