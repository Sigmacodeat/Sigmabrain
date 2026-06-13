/**
 * Sigmabrain Web Dashboard REST API.
 *
 * Thin HTTP layer over BrainEngine + operations for the Next.js product UI.
 * Mounted at /api/* by serve-http.ts. Intended for same-machine / trusted-proxy
 * use (default bind 127.0.0.1). Optional GBRAIN_WEB_API_KEY gates access.
 */

import express from 'express';
import type { Application, Request, Response, NextFunction } from 'express';
import type { BrainEngine } from '../core/engine.ts';
import { dispatchToolCall, buildOperationContext } from '../mcp/dispatch.ts';
import { importFromContent } from '../core/import-file.ts';
import {
  extractDocumentText,
  synthesizeDocumentMarkdown,
  isDocumentFilePath,
} from '../core/extract-document.ts';
import { slugifySegment } from '../core/sync.ts';
import { loadConfig } from '../core/config.ts';
import { OperationError } from '../core/operations.ts';
import type { ThinkResult } from '../core/think/index.ts';

export interface WebApiOptions {
  /** When set, require matching X-Sigmabrain-Api-Key or Authorization: Bearer header. */
  apiKey?: string;
}

interface ParsedMultipart {
  fields: Record<string, string>;
  file?: { filename: string; data: Buffer; mimeType: string };
}

function requireWebApiKey(apiKey: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!apiKey) return next();
    const header = (req.headers['x-sigmabrain-api-key'] as string | undefined)
      ?? (req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]);
    if (header !== apiKey) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing API key' });
      return;
    }
    next();
  };
}

function parseMultipart(body: Buffer, contentType: string): ParsedMultipart {
  const boundaryMatch = contentType.match(/boundary=([^;\s]+)/i);
  if (!boundaryMatch) throw new Error('Missing multipart boundary');
  const boundary = boundaryMatch[1].replace(/^"|"$/g, '');
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(body, delimiter).filter((p) => p.length > 2 && !p.slice(0, 4).equals(Buffer.from('--\r\n')));

  const fields: Record<string, string> = {};
  let file: ParsedMultipart['file'];

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerBlock = part.slice(0, headerEnd).toString('utf8');
    let content = part.slice(headerEnd + 4);
    if (content.slice(-2).equals(Buffer.from('\r\n'))) content = content.slice(0, -2);

    const disposition = headerBlock.match(/Content-Disposition:[^\r\n]*/i)?.[0] ?? '';
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const name = nameMatch?.[1];
    if (!name) continue;

    const mimeType = headerBlock.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? 'application/octet-stream';

    if (filenameMatch) {
      file = { filename: filenameMatch[1], data: content, mimeType };
    } else {
      fields[name] = content.toString('utf8');
    }
  }

  return { fields, file };
}

function splitBuffer(buf: Buffer, sep: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let idx = buf.indexOf(sep, start);
  while (idx !== -1) {
    if (idx > start) parts.push(buf.slice(start, idx));
    start = idx + sep.length;
    idx = buf.indexOf(sep, start);
  }
  if (start < buf.length) parts.push(buf.slice(start));
  return parts;
}

function slugFromUpload(source: string, filename: string, title?: string): string {
  const base = title
    ? slugifySegment(title)
    : slugifySegment(filename.replace(/\.[^.]+$/, ''));
  const src = slugifySegment(source) || 'documents';
  return `${src}/${base || 'untitled'}`;
}

async function buildMarkdownFromUpload(
  filename: string,
  data: Buffer,
  title?: string,
): Promise<string> {
  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';

  if (isDocumentFilePath(filename)) {
    const extracted = await extractDocumentText(data, ext, { filename });
    if (title) extracted.frontmatter.title = title;
    return synthesizeDocumentMarkdown(filename, extracted);
  }

  if (ext === '.json') {
    const parsed = JSON.parse(data.toString('utf8'));
    const body = '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
    const t = title ?? filename.replace(/\.[^.]+$/, '');
    return `---\ntitle: ${JSON.stringify(t)}\ntype: document\n---\n\n${body}\n`;
  }

  const text = data.toString('utf8');
  if (text.startsWith('---')) return text;
  const t = title ?? filename.replace(/\.[^.]+$/, '');
  return `---\ntitle: ${JSON.stringify(t)}\ntype: document\n---\n\n${text}\n`;
}

function mapStats(raw: Record<string, unknown>) {
  const pagesByType = (raw.pages_by_type ?? {}) as Record<string, number>;
  const entityTypes = ['person', 'company', 'idea', 'event', 'place'];
  const totalEntities = entityTypes.reduce((sum, t) => sum + (pagesByType[t] ?? 0), 0);

  return {
    total_pages: Number(raw.page_count ?? 0),
    total_entities: totalEntities,
    total_queries: 0,
    total_edges: Number(raw.link_count ?? 0),
    storage_used_mb: undefined,
    dream_cycle_last: undefined,
    last_synced: undefined,
    _engine: {
      chunk_count: Number(raw.chunk_count ?? 0),
      embedded_count: Number(raw.embedded_count ?? 0),
      tag_count: Number(raw.tag_count ?? 0),
      pages_by_type: pagesByType,
    },
  };
}

function mapSearchResults(results: Array<Record<string, unknown>>) {
  return results.map((r) => ({
    slug: String(r.slug ?? ''),
    title: String(r.title ?? r.slug ?? ''),
    snippet: String(r.chunk_text ?? r.snippet ?? '').slice(0, 300),
    score: Number(r.score ?? 0),
    source: r.source_id ? String(r.source_id) : undefined,
    created_at: undefined,
  }));
}

function mapPage(page: Record<string, unknown>, tags: string[] = []) {
  const body = String(page.compiled_truth ?? page.content ?? '');
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  return {
    slug: String(page.slug ?? ''),
    title: String(page.title ?? page.slug ?? ''),
    content: body,
    created_at: String(page.created_at ?? ''),
    updated_at: String(page.updated_at ?? ''),
    source: page.source_id ? String(page.source_id) : undefined,
    tags,
    word_count: wordCount,
    type: page.type ? String(page.type) : undefined,
  };
}

/**
 * Multi-tenant scoping (V1 provisioning): the Next.js dashboard proxies
 * forward the logged-in user's brainId as `x-sigmabrain-source` —
 * server-to-server, never from the browser. Every operation context and
 * every raw query in this module scopes to it; unknown/invalid headers
 * fall back to 'default' (single-tenant/self-hosted behavior unchanged).
 */
const SOURCE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function requestSourceId(req: Request): string {
  const h = req.headers['x-sigmabrain-source'];
  const v = Array.isArray(h) ? h[0] : h;
  return v && SOURCE_RE.test(v) ? v : 'default';
}

async function invokeOp(
  engine: BrainEngine,
  name: string,
  params: Record<string, unknown>,
  sourceId: string = 'default',
): Promise<unknown> {
  const result = await dispatchToolCall(engine, name, params, {
    remote: false,
    sourceId,
  });
  if (result.isError) {
    let msg = 'operation_failed';
    try {
      const parsed = JSON.parse(result.content[0]?.text ?? '{}');
      msg = parsed.error?.message ?? parsed.message ?? msg;
    } catch { /* ignore */ }
    throw new OperationError('web_api_error', msg);
  }
  try {
    return JSON.parse(result.content[0]?.text ?? 'null');
  } catch {
    return result.content[0]?.text;
  }
}

function streamThinkResult(res: Response, result: ThinkResult) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const answer = result.answer || '';
  const chunkSize = 48;
  for (let i = 0; i < answer.length; i += chunkSize) {
    res.write(`data: ${JSON.stringify({ chunk: answer.slice(i, i + chunkSize) })}\n\n`);
  }

  const citations = (result.citations ?? []).map((c) => ({
    slug: c.page_slug,
    title: c.page_slug,
    quote: '',
    confidence: 0.85,
  }));

  res.write(`data: ${JSON.stringify({ citations, gaps: result.gaps ?? [] })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

export function mountWebApi(app: Application, engine: BrainEngine, options: WebApiOptions = {}) {
  const guard = requireWebApiKey(options.apiKey ?? process.env.GBRAIN_WEB_API_KEY);
  const config = loadConfig() || { engine: 'pglite' as const };
  const ctx = (req: Request) =>
    buildOperationContext(engine, {}, { remote: false, sourceId: requestSourceId(req) });

  // pages.source_id has a FK on sources(id) — lazily provision the source
  // row the first time a tenant writes. Cached per process.
  const ensuredSources = new Set<string>(['default']);
  async function ensureSource(sourceId: string): Promise<void> {
    if (ensuredSources.has(sourceId)) return;
    await engine.executeRaw(
      `INSERT INTO sources (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
      [sourceId],
    );
    ensuredSources.add(sourceId);
  }

  app.use('/api', guard);

  app.get('/api/stats', async (req: Request, res: Response) => {
    try {
      const sourceId = requestSourceId(req);
      let mapped;
      if (sourceId === 'default') {
        const raw = await engine.getStats();
        mapped = mapStats(raw as unknown as Record<string, unknown>);
      } else {
        // Tenant view: engine.getStats() is brain-global; compute the
        // source-scoped numbers directly so no cross-tenant counts leak.
        const [row] = await engine.executeRaw<{
          page_count: number;
          entity_count: number;
          link_count: number;
        }>(
          `SELECT
             (SELECT count(*)::int FROM pages WHERE source_id = $1 AND deleted_at IS NULL) as page_count,
             (SELECT count(*)::int FROM pages WHERE source_id = $1 AND deleted_at IS NULL
                AND type IN ('person','company','idea','event','place')) as entity_count,
             (SELECT count(*)::int FROM links l
                JOIN pages fp ON fp.id = l.from_page_id
               WHERE fp.source_id = $1) as link_count`,
          [sourceId],
        );
        mapped = mapStats({
          page_count: row?.page_count ?? 0,
          link_count: row?.link_count ?? 0,
          pages_by_type: {},
        });
        mapped.total_entities = row?.entity_count ?? 0;
      }
      const [queriesToday] = await engine.executeRaw<{ count: number }>(
        `SELECT count(*)::int as count FROM mcp_request_log
         WHERE operation IN ('think', 'web_think', 'search', 'web_search')
           AND created_at > now() - interval '24 hours'`,
      ).catch(() => [{ count: 0 }]);
      mapped.total_queries = queriesToday?.count ?? 0;
      res.json(mapped);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      res.status(503).json({ error: 'service_unavailable', message: msg });
    }
  });

  app.get('/api/search', async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q ?? '');
      const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10) || 10, 50);
      if (!q.trim()) {
        res.json([]);
        return;
      }
      const raw = await invokeOp(engine, 'search', { query: q, limit }, requestSourceId(req));
      res.json(mapSearchResults(Array.isArray(raw) ? raw as Array<Record<string, unknown>> : []));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      res.status(500).json({ error: 'search_failed', message: msg });
    }
  });

  app.post('/api/think', express.json({ limit: '1mb' }), async (req: Request, res: Response) => {
    const query = String(req.body?.query ?? req.body?.question ?? '');
    if (!query.trim()) {
      res.status(400).json({ error: 'missing_query' });
      return;
    }
    try {
      const { runThink } = await import('../core/think/index.ts');
      const result = await runThink(engine, {
        question: query,
        remote: false,
        sourceId: requestSourceId(req),
      });
      streamThinkResult(res, result);
    } catch (e) {
      if (!res.headersSent) {
        const msg = e instanceof Error ? e.message : 'unknown';
        res.status(500).json({ error: 'think_failed', message: msg });
      }
    }
  });

  app.get('/api/pages', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
      const type = req.query.type ? String(req.query.type) : undefined;
      const tag = req.query.tag ? String(req.query.tag) : undefined;
      const raw = await invokeOp(engine, 'list_pages', {
        limit,
        ...(type ? { type } : {}),
        ...(tag ? { tag } : {}),
        sort: 'updated_desc',
      }, requestSourceId(req));
      const pages = (Array.isArray(raw) ? raw : []).map((p) => {
        const pg = p as Record<string, unknown>;
        return {
          slug: String(pg.slug ?? ''),
          title: String(pg.title ?? pg.slug ?? ''),
          content: '',
          created_at: '',
          updated_at: String(pg.updated_at ?? ''),
          source: undefined,
          tags: [],
          word_count: undefined,
          type: pg.type ? String(pg.type) : 'document',
        };
      });
      res.json(pages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      res.status(500).json({ error: 'list_pages_failed', message: msg });
    }
  });

  app.get('/api/pages/{*slug}', async (req: Request, res: Response) => {
    try {
      const slugParam = req.params.slug;
      const slug = Array.isArray(slugParam) ? slugParam.join('/') : String(slugParam ?? '');
      const pageRaw = await invokeOp(engine, 'get_page', { slug }, requestSourceId(req));
      const page = pageRaw as Record<string, unknown>;
      const tags = Array.isArray(page.tags) ? (page.tags as string[]) : [];
      res.json(mapPage(page, tags));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      const status = msg.includes('not found') || msg.includes('page_not_found') ? 404 : 500;
      res.status(status).json({ error: 'get_page_failed', message: msg });
    }
  });

  app.get('/api/graph', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10) || 200, 500);
      const sourceId = requestSourceId(req);
      const rows = await engine.executeRaw<{
        from_slug: string;
        from_title: string;
        from_type: string;
        to_slug: string;
        to_title: string;
        to_type: string;
        link_type: string;
      }>(
        `SELECT
           fp.slug as from_slug, fp.title as from_title, fp.type as from_type,
           tp.slug as to_slug, tp.title as to_title, tp.type as to_type,
           l.link_type
         FROM links l
         JOIN pages fp ON fp.id = l.from_page_id AND fp.deleted_at IS NULL
         JOIN pages tp ON tp.id = l.to_page_id AND tp.deleted_at IS NULL
         WHERE fp.source_id = $2 AND tp.source_id = $2
         ORDER BY l.id DESC
         LIMIT $1`,
        [limit, sourceId],
      );

      const nodeMap = new Map<string, { id: string; name: string; type: string; connections: number }>();
      const links: Array<{ source: string; target: string; type: string }> = [];

      const entityTypes = new Set(['person', 'company', 'idea', 'document', 'event', 'place']);

      for (const row of rows) {
        for (const [slug, title, type] of [
          [row.from_slug, row.from_title, row.from_type],
          [row.to_slug, row.to_title, row.to_type],
        ] as const) {
          if (!nodeMap.has(slug)) {
            nodeMap.set(slug, {
              id: slug,
              name: title || slug.split('/').pop() || slug,
              type: entityTypes.has(type) ? type : 'document',
              connections: 0,
            });
          }
        }
        links.push({ source: row.from_slug, target: row.to_slug, type: row.link_type });
        nodeMap.get(row.from_slug)!.connections += 1;
        nodeMap.get(row.to_slug)!.connections += 1;
      }

      res.json({ nodes: [...nodeMap.values()], links });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      res.status(500).json({ error: 'graph_failed', message: msg });
    }
  });

  app.get('/api/queries/recent', async (req: Request, res: Response) => {
    try {
      // mcp_request_log has no source column — for tenant sources return
      // an empty list rather than leaking other tenants' query texts.
      if (requestSourceId(req) !== 'default') {
        res.json([]);
        return;
      }
      const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10) || 10, 50);
      const rows = await engine.executeRaw<{
        id: number;
        operation: string;
        params: Record<string, unknown> | string | null;
        created_at: string;
      }>(
        `SELECT id, operation, params, created_at::text
         FROM mcp_request_log
         WHERE operation IN ('think', 'web_think', 'search', 'web_search')
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit],
      ).catch(() => []);

      const queries = rows.map((row) => {
        let queryText = '';
        const params = typeof row.params === 'string'
          ? (() => { try { return JSON.parse(row.params); } catch { return {}; } })()
          : (row.params ?? {});
        queryText = String(
          (params as Record<string, unknown>).query
          ?? (params as Record<string, unknown>).question
          ?? ((params as Record<string, unknown>).declared_keys as unknown[] | undefined)?.[0]
          ?? row.operation,
        );
        return {
          id: String(row.id),
          query: queryText,
          answer_preview: '',
          citations_count: 0,
          created_at: row.created_at,
        };
      });

      res.json(queries);
    } catch (e) {
      res.status(500).json({ error: 'recent_queries_failed' });
    }
  });

  app.post(
    '/api/upload',
    express.raw({ type: () => true, limit: '50mb' }),
    async (req: Request, res: Response) => {
      try {
        const contentType = String(req.headers['content-type'] ?? '');
        if (!contentType.includes('multipart/form-data')) {
          res.status(400).json({ error: 'expected_multipart' });
          return;
        }
        if (!Buffer.isBuffer(req.body)) {
          res.status(400).json({ error: 'empty_body' });
          return;
        }

        const { fields, file } = parseMultipart(req.body, contentType);
        if (!file) {
          res.status(400).json({ error: 'missing_file' });
          return;
        }

        const source = fields.source || 'documents';
        const title = fields.title || undefined;
        let tagList: string[] = [];
        if (fields.tags) {
          try {
            const parsed = JSON.parse(fields.tags);
            tagList = Array.isArray(parsed) ? parsed.map(String) : fields.tags.split(',').map((t) => t.trim()).filter(Boolean);
          } catch {
            tagList = fields.tags.split(',').map((t) => t.trim()).filter(Boolean);
          }
        }

        const slug = slugFromUpload(source, file.filename, title);
        const markdown = await buildMarkdownFromUpload(file.filename, file.data, title);
        const opCtx = ctx(req);
        const tenantSource = opCtx.sourceId ?? 'default';
        await ensureSource(tenantSource);

        await importFromContent(engine, slug, markdown, {
          sourceId: tenantSource,
          filename: file.filename,
          source_kind: 'web_upload',
          source_uri: `sigmabrain-upload:${slug}`,
        });

        if (tagList.length > 0) {
          for (const tag of tagList) {
            try {
              await invokeOp(engine, 'add_tag', { slug, tag }, tenantSource);
            } catch { /* best effort */ }
          }
        }

        const page = await engine.getPage(slug, { sourceId: opCtx.sourceId });
        res.json({
          slug,
          title: page?.title ?? title ?? slug.split('/').pop() ?? slug,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        res.status(500).json({ error: 'upload_failed', message: msg });
      }
    },
  );

  console.error(`[web-api] Sigmabrain dashboard REST API mounted at /api/* (engine: ${config.engine})`);
}