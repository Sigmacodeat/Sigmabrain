/**
 * Slack trigger relay — receives slash commands from Slack, validates
 * them against workspace policies, and relays approved triggers.
 *
 * WP-208 scope:
 *   - Receive Slack slash commands (e.g. /gbrain search ...)
 *   - Map workspace → tenant via installation registry
 *   - Check trigger policy (allow/deny per workspace)
 *   - Reject triggers from unregistered or disabled workspaces
 *
 * Security:
 *   - Request signature verification (HMAC-SHA256) using Slack signing secret
 *   - Workspace must be registered (app installed) to accept triggers
 *   - Rate limiting per workspace
 *   - No trigger execution without policy approval
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const REPLAY_WINDOW_SECONDS = 60 * 5;

export interface SlackTriggerContext {
  workspace_id: string;
  workspace_name: string;
  tenant_id: string;
  user_id: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id?: string;
}

export interface SlackTriggerPolicy {
  enabled: boolean;
  allowed_commands: string[];
  blocked_users: string[];
  rate_limit_per_hour: number;
}

export interface SlackTriggerResult {
  approved: boolean;
  reason?: string;
  context?: SlackTriggerContext;
}

export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  signature: string,
  rawBody: string,
): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > REPLAY_WINDOW_SECONDS) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const computed = createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const computedBuf = Buffer.from(computed, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');
  if (computedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(computedBuf, signatureBuf);
}

interface WorkspaceEntry {
  workspace_id: string;
  workspace_name: string;
  tenant_id: string;
  bot_token: string;
  signing_secret: string;
  policy: SlackTriggerPolicy;
  installed_at: number;
}

export class WorkspaceRegistry {
  private workspaces = new Map<string, WorkspaceEntry>();

  register(entry: {
    workspace_id: string;
    workspace_name: string;
    tenant_id: string;
    bot_token: string;
    signing_secret: string;
    policy?: Partial<SlackTriggerPolicy>;
  }): void {
    this.workspaces.set(entry.workspace_id, {
      workspace_id: entry.workspace_id,
      workspace_name: entry.workspace_name,
      tenant_id: entry.tenant_id,
      bot_token: entry.bot_token,
      signing_secret: entry.signing_secret,
      policy: {
        enabled: entry.policy?.enabled ?? true,
        allowed_commands: entry.policy?.allowed_commands ?? ['gbrain', 'search', 'ask', 'summarize'],
        blocked_users: entry.policy?.blocked_users ?? [],
        rate_limit_per_hour: entry.policy?.rate_limit_per_hour ?? 100,
      },
      installed_at: Date.now(),
    });
  }

  unregister(workspaceId: string): void {
    this.workspaces.delete(workspaceId);
  }

  get(workspaceId: string): WorkspaceEntry | undefined {
    return this.workspaces.get(workspaceId);
  }

  isRegistered(workspaceId: string): boolean {
    return this.workspaces.has(workspaceId);
  }

  list(): Array<{ workspace_id: string; workspace_name: string; tenant_id: string }> {
    return Array.from(this.workspaces.values()).map((w) => ({
      workspace_id: w.workspace_id,
      workspace_name: w.workspace_name,
      tenant_id: w.tenant_id,
    }));
  }
}

class TriggerRateLimiter {
  private counts = new Map<string, { windowStart: number; count: number }>();

  check(workspaceId: string, limitPerHour: number): boolean {
    const now = Date.now();
    const entry = this.counts.get(workspaceId);
    if (!entry || now - entry.windowStart > 3600_000) {
      this.counts.set(workspaceId, { windowStart: now, count: 1 });
      return true;
    }
    if (entry.count >= limitPerHour) return false;
    entry.count++;
    return true;
  }
}

const rateLimiter = new TriggerRateLimiter();

export function processTrigger(
  body: Record<string, string>,
  headers: { 'x-slack-signature'?: string; 'x-slack-request-timestamp'?: string },
  rawBody: string,
  registry: WorkspaceRegistry,
): SlackTriggerResult {
  const signature = headers['x-slack-signature'];
  const timestamp = headers['x-slack-request-timestamp'];

  if (!signature || !timestamp) {
    return { approved: false, reason: 'Missing signature headers' };
  }

  const workspaceId = body['team_id'];
  if (!workspaceId) {
    return { approved: false, reason: 'Missing team_id in body' };
  }

  const workspace = registry.get(workspaceId);
  if (!workspace) {
    return { approved: false, reason: 'Workspace not registered' };
  }

  if (!verifySlackSignature(workspace.signing_secret, timestamp, signature, rawBody)) {
    return { approved: false, reason: 'Invalid request signature' };
  }

  if (!workspace.policy.enabled) {
    return { approved: false, reason: 'Triggers disabled for this workspace' };
  }

  const userId = body['user_id'] ?? '';
  if (workspace.policy.blocked_users.includes(userId)) {
    return { approved: false, reason: 'User blocked from triggers' };
  }

  const command = body['command'] ?? '';
  const commandName = command.replace(/^\//, '').split(' ')[0];
  if (!workspace.policy.allowed_commands.includes(commandName)) {
    return { approved: false, reason: `Command "${commandName}" not allowed` };
  }

  if (!rateLimiter.check(workspaceId, workspace.policy.rate_limit_per_hour)) {
    return { approved: false, reason: 'Rate limit exceeded' };
  }

  return {
    approved: true,
    context: {
      workspace_id: workspace.workspace_id,
      workspace_name: workspace.workspace_name,
      tenant_id: workspace.tenant_id,
      user_id: userId,
      command: commandName,
      text: body['text'] ?? '',
      response_url: body['response_url'] ?? '',
      trigger_id: body['trigger_id'],
    },
  };
}
