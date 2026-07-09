/**
 * M365Connector — ingest Microsoft 365 content via Microsoft Graph API.
 *
 * Features:
 *   - OAuth2 token refresh (via m365-oauth.ts)
 *   - Delta sync for OneDrive/SharePoint files (Graph delta API)
 *   - Exchange mail ingestion (Graph /me/messages)
 *   - Exchange calendar events (Graph /me/events)
 *   - Tenant-scoped tokens (configurable tenant ID)
 *   - Content-type routing: PDF, DOCX, text, HTML
 *   - Folder/site filtering
 *
 * Setup:
 *   1. Register an app in Azure AD (Entra ID)
 *   2. Add redirect URI: http://localhost:3000/oauth/callback
 *   3. Add API permissions: Files.Read.All, Mail.Read, Calendars.Read
 *   4. Run: gbrain connector add m365 --client-id XXX --client-secret YYY --tenant <tenant-id>
 *   5. Complete OAuth2 flow: gbrain connector auth m365
 *
 * Read ingest only — no write-back, no send-mail, no calendar modifications.
 */

import {
  BaseConnector,
  type ConnectorConfig,
  type ConnectorItem,
} from './base.ts';
import {
  type IngestionEvent,
  type IngestionContentType,
} from '../types.ts';
import { refreshAccessToken } from './m365-oauth.ts';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/** M365-specific config extensions. */
interface M365ConnectorConfig extends ConnectorConfig {
  /** Azure AD tenant ID ('common', 'consumers', or specific UUID). */
  tenant?: string;
  /** Which M365 sources to ingest: 'files', 'mail', 'calendar'. Default: all. */
  sources?: string[];
}

interface GraphDriveItem {
  id: string;
  name: string;
  lastModifiedDateTime: string;
  webUrl?: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: { driveId?: string; siteId?: string };
}

interface GraphDriveDelta {
  value: GraphDriveItem[];
  '@odata.deltaLink'?: string;
  '@odata.nextLink'?: string;
}

interface GraphMessage {
  id: string;
  subject?: string;
  body?: { content: string; contentType: string };
  receivedDateTime: string;
  webLink?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
}

interface GraphEvent {
  id: string;
  subject?: string;
  body?: { content: string; contentType: string };
  start?: { dateTime: string };
  end?: { dateTime: string };
  webLink?: string;
  location?: { displayName?: string };
}

export class M365Connector extends BaseConnector {
  private readonly _tenant: string;
  private readonly _sources: Set<string>;

  constructor(config: M365ConnectorConfig = {}) {
    super('m365', config);
    this._tenant = config.tenant ?? 'common';
    this._sources = new Set(config.sources ?? ['files', 'mail', 'calendar']);
  }

  getApiRateLimit(): { capacity: number; windowMs: number } {
    // Graph API: 10,000 requests per 10 minutes per app per tenant.
    return { capacity: 100, windowMs: 60_000 };
  }

  async refreshToken(): Promise<void> {
    const state = await this._loadState();
    if (!state?.refresh_token) throw new Error('No refresh token available');

    const res = await refreshAccessToken(
      state.refresh_token,
      this._config.client_id ?? '',
      this._config.client_secret ?? '',
      this._tenant,
    );

    this.updateTokens(res.access_token, res.refresh_token ?? state.refresh_token, res.expires_in);
  }

  async fetchDelta(cursor?: string): Promise<{ items: ConnectorItem[]; nextCursor?: string }> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const items: ConnectorItem[] = [];
    const cursors: string[] = [];

    // Parse composite cursor: "files:<delta>|mail:<skip>|calendar:<skip>"
    const cursorMap = this._parseCursor(cursor);

    if (this._sources.has('files')) {
      const fileResult = await this._fetchFilesDelta(token, cursorMap.get('files'));
      items.push(...fileResult.items);
      if (fileResult.nextCursor) cursors.push(`files:${fileResult.nextCursor}`);
    }

    if (this._sources.has('mail')) {
      const mailResult = await this._fetchMailDelta(token, cursorMap.get('mail'));
      items.push(...mailResult.items);
      if (mailResult.nextCursor) cursors.push(`mail:${mailResult.nextCursor}`);
    }

    if (this._sources.has('calendar')) {
      const calResult = await this._fetchCalendarDelta(token, cursorMap.get('calendar'));
      items.push(...calResult.items);
      if (calResult.nextCursor) cursors.push(`calendar:${calResult.nextCursor}`);
    }

    const nextCursor = cursors.length > 0 ? cursors.join('|') : undefined;
    return { items, nextCursor };
  }

  async toIngestionEvent(item: ConnectorItem): Promise<IngestionEvent> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const sourceType = (item.metadata?.source_type as string) ?? 'file';
    let content = item.content;
    let contentType = item.content_type ?? 'unknown';

    if (sourceType === 'file' && item.metadata?.download_url) {
      // Download file content from Graph API.
      const res = await fetch(item.metadata.download_url as string, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`M365 file download failed: ${res.status}`);

      const mime = item.content_type ?? 'application/octet-stream';
      if (mime.startsWith('text/') || mime === 'text/html' || mime === 'text/plain') {
        content = await res.text();
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        content = buf.toString('base64');
      }
    }

    const detectedType = this.detectContentType(item.title ?? '', contentType) as IngestionContentType;

    return {
      source_id: this.id,
      source_kind: this.kind,
      source_uri: item.url ?? `m365://${item.id}`,
      received_at: new Date().toISOString(),
      content_type: detectedType,
      content,
      content_hash: this.hashContent(content),
      metadata: {
        ...item.metadata,
        connector: this.service,
        tenant: this._tenant,
        m365_item_id: item.id,
        m365_item_name: item.title,
      },
    };
  }

  // ── Internal: Files (OneDrive/SharePoint) ───────────────────────────

  private async _fetchFilesDelta(
    token: string,
    cursor?: string,
  ): Promise<{ items: ConnectorItem[]; nextCursor?: string }> {
    const items: ConnectorItem[] = [];
    let url: string;

    if (cursor) {
      // Delta link from previous sync — use it directly.
      url = cursor;
    } else {
      // First sync: start delta from /me/drive/root/delta.
      // For SharePoint sites, use /sites/{siteId}/drive/root/delta.
      const siteFilter = this._config.filters?.site as string | undefined;
      if (siteFilter) {
        url = `${GRAPH_BASE}/sites/${siteFilter}/drive/root/delta`;
      } else {
        url = `${GRAPH_BASE}/me/drive/root/delta`;
      }
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`M365 files delta failed: ${res.status}`);

    const data = (await res.json()) as GraphDriveDelta;

    for (const item of data.value ?? []) {
      // Skip folders — we only ingest file content.
      if (item.folder) continue;
      if (!item.file) continue;

      const mime = item.file.mimeType ?? 'application/octet-stream';
      const folderFilter = this._config.filters?.folder as string | undefined;
      if (folderFilter && !item.parentReference?.driveId?.includes(folderFilter)) continue;

      items.push({
        id: item.id,
        title: item.name,
        modified_at: item.lastModifiedDateTime,
        content: `${GRAPH_BASE}/me/drive/items/${item.id}/content`,
        content_type: mime,
        url: item.webUrl,
        metadata: {
          source_type: 'file',
          download_url: `${GRAPH_BASE}/me/drive/items/${item.id}/content`,
          mime_type: mime,
          drive_id: item.parentReference?.driveId,
          site_id: item.parentReference?.siteId,
        },
      });
    }

    // deltaLink is the cursor for next sync; nextLink means more pages now.
    const nextCursor = data['@odata.deltaLink'] ?? data['@odata.nextLink'];
    return { items, nextCursor };
  }

  // ── Internal: Mail (Exchange) ────────────────────────────────────────

  private async _fetchMailDelta(
    token: string,
    cursor?: string,
  ): Promise<{ items: ConnectorItem[]; nextCursor?: string }> {
    const items: ConnectorItem[] = [];

    const url = new URL(`${GRAPH_BASE}/me/messages`);
    url.searchParams.set('$top', String(this._config.batch_size ?? 50));
    url.searchParams.set('$select', 'id,subject,body,receivedDateTime,webLink,from');
    url.searchParams.set('$orderby', 'receivedDateTime desc');

    // Use skip token as cursor if available.
    if (cursor) {
      url.searchParams.set('$skip', cursor);
    }

    // Apply folder filter if configured.
    const folderFilter = this._config.filters?.folder as string | undefined;
    const basePath = folderFilter
      ? `${GRAPH_BASE}/me/mailFolders/${folderFilter}/messages`
      : `${GRAPH_BASE}/me/messages`;
    url.pathname = new URL(basePath, GRAPH_BASE).pathname;

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`M365 mail fetch failed: ${res.status}`);

    const data = (await res.json()) as { value: GraphMessage[]; '@odata.nextLink'?: string };

    for (const msg of data.value ?? []) {
      const bodyContent = msg.body?.content ?? '';
      const contentType = msg.body?.contentType === 'HTML' ? 'text/html' : 'text/plain';

      items.push({
        id: msg.id,
        title: msg.subject ?? '(no subject)',
        modified_at: msg.receivedDateTime,
        content: bodyContent,
        content_type: contentType,
        url: msg.webLink,
        metadata: {
          source_type: 'mail',
          from_address: msg.from?.emailAddress?.address,
          from_name: msg.from?.emailAddress?.name,
          received_at: msg.receivedDateTime,
        },
      });
    }

    // Extract skip token from nextLink for cursor.
    const nextLink = data['@odata.nextLink'];
    let nextCursor: string | undefined;
    if (nextLink) {
      const nextUrl = new URL(nextLink);
      nextCursor = nextUrl.searchParams.get('$skip') ?? undefined;
    }

    return { items, nextCursor };
  }

  // ── Internal: Calendar (Exchange) ────────────────────────────────────

  private async _fetchCalendarDelta(
    token: string,
    cursor?: string,
  ): Promise<{ items: ConnectorItem[]; nextCursor?: string }> {
    const items: ConnectorItem[] = [];

    const url = new URL(`${GRAPH_BASE}/me/events`);
    url.searchParams.set('$top', String(this._config.batch_size ?? 50));
    url.searchParams.set('$select', 'id,subject,body,start,end,webLink,location');
    url.searchParams.set('$orderby', 'start/dateTime desc');

    if (cursor) {
      url.searchParams.set('$skip', cursor);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`M365 calendar fetch failed: ${res.status}`);

    const data = (await res.json()) as { value: GraphEvent[]; '@odata.nextLink'?: string };

    for (const evt of data.value ?? []) {
      const bodyContent = evt.body?.content ?? '';
      const contentType = evt.body?.contentType === 'HTML' ? 'text/html' : 'text/plain';

      items.push({
        id: evt.id,
        title: evt.subject ?? '(no title)',
        modified_at: evt.start?.dateTime ?? new Date().toISOString(),
        content: bodyContent,
        content_type: contentType,
        url: evt.webLink,
        metadata: {
          source_type: 'calendar',
          start: evt.start?.dateTime,
          end: evt.end?.dateTime,
          location: evt.location?.displayName,
        },
      });
    }

    const nextLink = data['@odata.nextLink'];
    let nextCursor: string | undefined;
    if (nextLink) {
      const nextUrl = new URL(nextLink);
      nextCursor = nextUrl.searchParams.get('$skip') ?? undefined;
    }

    return { items, nextCursor };
  }

  // ── Internal: Cursor parsing ─────────────────────────────────────────

  private _parseCursor(cursor?: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!cursor) return map;
    for (const part of cursor.split('|')) {
      const [key, ...valueParts] = part.split(':');
      if (key && valueParts.length > 0) {
        map.set(key, valueParts.join(':'));
      }
    }
    return map;
  }
}
