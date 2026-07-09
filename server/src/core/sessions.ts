/**
 * Session Manager — manages OIDC sessions for enterprise SSO.
 *
 * WP-209 scope:
 *   - Session issuance after OIDC callback
 *   - Session validation on authenticated requests
 *   - Session invalidation on logout
 *   - Auditable tenant identity mapping
 *
 * Security:
 *   - Session tokens are 256-bit random, opaque
 *   - Automatic expiry cleanup
 *   - Tenant isolation enforced in session lookup
 */

import { randomBytes } from 'node:crypto';
import type { OIDCSession } from './oidc-provider.ts';

const SESSION_COOKIE_NAME = 'gbrain_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_REFRESH_THRESHOLD_MS = 60 * 60 * 1000;

export interface SessionInfo {
  session_id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  idp_id: string;
  issued_at: number;
  expires_at: number;
  time_remaining_ms: number;
}

export interface AuditEntry {
  timestamp: number;
  event: 'login_started' | 'login_completed' | 'logout' | 'session_expired' | 'session_refreshed';
  tenant_id?: string;
  user_id?: string;
  user_email?: string;
  idp_id?: string;
  session_id?: string;
  detail?: string;
}

export class SessionManager {
  private sessions = new Map<string, OIDCSession>();
  private auditLog: AuditEntry[] = [];
  private readonly maxAuditLogSize = 10_000;

  createSession(params: {
    tenant_id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    idp_id: string;
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  }): OIDCSession {
    const sessionId = randomBytes(32).toString('base64url');
    const now = Date.now();
    const session: OIDCSession = {
      session_id: sessionId,
      tenant_id: params.tenant_id,
      user_id: params.user_id,
      user_email: params.user_email,
      user_name: params.user_name,
      idp_id: params.idp_id,
      issued_at: now,
      expires_at: now + SESSION_TTL_MS,
      id_token: params.id_token,
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    };
    this.sessions.set(sessionId, session);
    this._audit({
      timestamp: now, event: 'login_completed',
      tenant_id: params.tenant_id, user_id: params.user_id,
      user_email: params.user_email, idp_id: params.idp_id, session_id: sessionId,
    });
    return session;
  }

  validate(sessionId: string): SessionInfo | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const now = Date.now();
    if (now > session.expires_at) {
      this.sessions.delete(sessionId);
      this._audit({
        timestamp: now, event: 'session_expired',
        tenant_id: session.tenant_id, user_id: session.user_id, session_id: sessionId,
      });
      return undefined;
    }

    const timeRemaining = session.expires_at - now;
    if (timeRemaining < SESSION_REFRESH_THRESHOLD_MS) {
      session.expires_at = now + SESSION_TTL_MS;
      this._audit({
        timestamp: now, event: 'session_refreshed',
        tenant_id: session.tenant_id, user_id: session.user_id, session_id: sessionId,
      });
    }

    return {
      session_id: session.session_id,
      tenant_id: session.tenant_id,
      user_id: session.user_id,
      user_email: session.user_email,
      user_name: session.user_name,
      idp_id: session.idp_id,
      issued_at: session.issued_at,
      expires_at: session.expires_at,
      time_remaining_ms: session.expires_at - now,
    };
  }

  logout(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    this._audit({
      timestamp: Date.now(), event: 'logout',
      tenant_id: session.tenant_id, user_id: session.user_id,
      user_email: session.user_email, idp_id: session.idp_id, session_id: sessionId,
    });
    return true;
  }

  getTenantSessions(tenantId: string): SessionInfo[] {
    const now = Date.now();
    const result: SessionInfo[] = [];
    for (const [id, session] of this.sessions) {
      if (session.tenant_id !== tenantId) continue;
      if (now > session.expires_at) {
        this.sessions.delete(id);
        continue;
      }
      result.push({
        session_id: session.session_id, tenant_id: session.tenant_id,
        user_id: session.user_id, user_email: session.user_email,
        user_name: session.user_name, idp_id: session.idp_id,
        issued_at: session.issued_at, expires_at: session.expires_at,
        time_remaining_ms: session.expires_at - now,
      });
    }
    return result;
  }

  getAuditLog(tenantId?: string, limit: number = 100): AuditEntry[] {
    let entries = this.auditLog;
    if (tenantId) entries = entries.filter((e) => e.tenant_id === tenantId);
    return entries.slice(-limit);
  }

  recordLoginStarted(idpId: string, detail?: string): void {
    this._audit({ timestamp: Date.now(), event: 'login_started', idp_id: idpId, detail });
  }

  get cookieName(): string { return SESSION_COOKIE_NAME; }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (now > session.expires_at) { this.sessions.delete(id); removed++; }
    }
    return removed;
  }

  private _audit(entry: AuditEntry): void {
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditLogSize) this.auditLog.shift();
  }
}

let _sessionManager: SessionManager | undefined;
export function getSessionManager(): SessionManager {
  if (!_sessionManager) _sessionManager = new SessionManager();
  return _sessionManager;
}
