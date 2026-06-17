"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Bot,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Send,
  MessageSquare,
  User,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface AgentJob {
  id: number;
  name: string;
  status: "waiting" | "active" | "completed" | "failed" | "paused";
  prompt: string;
  model?: string;
  progress?: { step: number; total: number; message: string };
  tokens?: { input: number; output: number; cache: number };
  cost?: number;
  startedAt?: string;
  completedAt?: string;
  parentId?: number;
  subagentDef?: string;
  result?: string;
}

// ── API Helpers ──────────────────────────────────────────────

async function fetchAgents(): Promise<AgentJob[]> {
  try {
    const res = await fetch("/api/agents");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.jobs || data.jobs.length === 0) return [];
    return data.jobs.map((j: Record<string, unknown>) => ({
      id: Number(j.id),
      name: String(j.name ?? ""),
      status: String(j.status ?? "waiting") as AgentJob["status"],
      prompt: String(j.prompt ?? ""),
      model: j.model ? String(j.model) : undefined,
      progress: j.progress ? (j.progress as { step: number; total: number; message: string }) : undefined,
      tokens: j.tokens ? (j.tokens as { input: number; output: number; cache: number }) : undefined,
      // Rough Sonnet-class estimate: $3/M input, $15/M output; cache reads
      // ~10% of input price. Display orientation only, not billing.
      cost: j.tokens
        ? (() => {
            const t = j.tokens as { input: number; output: number; cache: number };
            return (t.input * 3 + t.output * 15 + t.cache * 0.3) / 1_000_000;
          })()
        : undefined,
      startedAt: j.startedAt ? String(j.startedAt) : undefined,
      completedAt: j.finishedAt ? String(j.finishedAt) : undefined,
      parentId: j.parentId ? Number(j.parentId) : undefined,
      subagentDef: j.subagent_def ? String(j.subagent_def) : undefined,
      result: j.result ? JSON.stringify(j.result).slice(0, 500) : undefined,
    }));
  } catch {
    return [];
  }
}

async function pauseJob(id: number) {
  const res = await fetch(`/api/agents/${id}/pause`, { method: "POST" });
  return res.ok;
}

async function resumeJob(id: number) {
  const res = await fetch(`/api/agents/${id}/resume`, { method: "POST" });
  return res.ok;
}

async function cancelJob(id: number) {
  const res = await fetch(`/api/agents/${id}/cancel`, { method: "POST" });
  return res.ok;
}

async function replayJob(id: number) {
  const res = await fetch(`/api/agents/${id}/replay`, { method: "POST" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.newJobId as number | null;
}

// ── Inbox API ──────────────────────────────────────────────

interface InboxMessage {
  id: number;
  job_id: number;
  sender: string;
  payload: unknown;
  sent_at: string;
  read_at: string | null;
}

async function fetchInbox(id: number): Promise<InboxMessage[]> {
  try {
    const res = await fetch(`/api/agents/${id}/inbox`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.messages ?? []) as InboxMessage[];
  } catch {
    return [];
  }
}

async function sendInboxMessage(id: number, text: string): Promise<InboxMessage | null> {
  const res = await fetch(`/api/agents/${id}/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: text }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.message as InboxMessage | null;
}

function formatInboxPayload(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object" || payload === null) return String(payload);

  const p = payload as Record<string, unknown>;

  // child_done messages from the minions system
  if (p.type === "child_done") {
    const childId = p.child_id ?? "?";
    const outcome = p.outcome === "complete" ? "abgeschlossen" :
                  p.outcome === "failed" ? "fehlgeschlagen" :
                  String(p.outcome ?? "unbekannt");
    return `Sub-Agent #${childId} ${outcome}.`;
  }

  // cancel / timeout system messages
  if (p.type === "cancelled") return `Job abgebrochen${p.error ? `: ${p.error}` : ""}`;
  if (p.type === "timeout") return `Zeitlimit überschritten${p.error ? `: ${p.error}` : ""}`;

  // Generic fallback: pretty-print known keys, else JSON
  const readable = Object.entries(p)
    .filter(([k]) => k !== "type")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");
  return readable || JSON.stringify(payload);
}

async function submitSupervisor(prompt: string, opts?: { forceSpecialists?: string[]; skipCritic?: boolean }) {
  // POST /api/agents — the catch-all /api/agents/[...slug] route would
  // interpret "supervisor" as a job id and answer 400.
  const res = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      ...(opts?.forceSpecialists ? { force_specialists: opts.forceSpecialists } : {}),
      ...(opts?.skipCritic ? { skip_critic: true } : {}),
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.jobId as number | null;
}

function useAgents() {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchAgents();
    setJobs(data);
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll every 3s while active jobs exist.
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === "active" || j.status === "waiting");
    if (!hasActive) return;
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [jobs, refresh]);

  return { jobs, loading, refresh, lastRefresh };
}

// ── Status Helpers ───────────────────────────────────────────

function statusColor(status: AgentJob["status"]): string {
  switch (status) {
    case "completed": return "bg-emerald-500";
    case "active": return "bg-blue-500 animate-pulse";
    case "waiting": return "bg-amber-500";
    case "failed": return "bg-red-500";
    case "paused": return "bg-gray-500";
  }
}

function statusLabel(status: AgentJob["status"]): string {
  switch (status) {
    case "completed": return "Fertig";
    case "active": return "Aktiv";
    case "waiting": return "Wartend";
    case "failed": return "Fehler";
    case "paused": return "Pausiert";
  }
}

function statusIcon(status: AgentJob["status"]) {
  switch (status) {
    case "completed": return <CheckCircle2 size={14} className="text-emerald-600" />;
    case "active": return <Loader2 size={14} className="text-blue-600 animate-spin" />;
    case "waiting": return <Clock size={14} className="text-amber-600" />;
    case "failed": return <XCircle size={14} className="text-red-600" />;
    case "paused": return <Pause size={14} className="text-gray-400" />;
  }
}

// ── DAG Component ────────────────────────────────────────────

function AgentDAG({ jobs, selectedJob, onSelectJob }: {
  jobs: AgentJob[];
  selectedJob: number | null;
  onSelectJob: (id: number) => void;
}) {
  const rootJobs = useMemo(() => jobs.filter(j => !j.parentId), [jobs]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[600px] p-6">
        <svg width="100%" height="300" viewBox="0 0 800 300">
          {/* Draw connections */}
          {rootJobs.map((root, rootIdx) => {
            const children = jobs.filter(j => j.parentId === root.id);
            const rootX = 100;
            const rootY = 80 + rootIdx * 140;

            return children.map((child, childIdx) => {
              const childX = 500;
              const childY = 40 + childIdx * 80 + rootIdx * 20;
              const midX = (rootX + childX) / 2;

              return (
                <g key={`conn-${root.id}-${child.id}`}>
                  {/* Connection path */}
                  <path
                    d={`M ${rootX + 70} ${rootY} C ${midX} ${rootY}, ${midX} ${childY}, ${childX - 70} ${childY}`}
                    fill="none"
                    stroke={child.status === "completed" ? "#10b981" : child.status === "active" ? "#3b82f6" : child.status === "failed" ? "#ef4444" : "#f59e0b"}
                    strokeWidth={2}
                    strokeDasharray={child.status === "waiting" ? "4 4" : undefined}
                    opacity={0.6}
                  />
                  {/* Arrow head */}
                  <polygon
                    points={`${childX - 70},${childY} ${childX - 78},${childY - 4} ${childX - 78},${childY + 4}`}
                    fill={child.status === "completed" ? "#10b981" : child.status === "active" ? "#3b82f6" : child.status === "failed" ? "#ef4444" : "#f59e0b"}
                  />
                </g>
              );
            });
          })}

          {/* Draw nodes */}
          {jobs.map(job => {
            const isRoot = !job.parentId;
            const isSelected = selectedJob === job.id;

            // Calculate position
            let x: number, y: number;
            if (isRoot) {
              const rootIdx = rootJobs.findIndex(r => r.id === job.id);
              x = 30;
              y = 50 + rootIdx * 140;
            } else {
              const parent = jobs.find(j => j.id === job.parentId);
              const parentIdx = rootJobs.findIndex(r => r.id === parent?.parentId || r.id === parent?.id);
              const siblingIdx = jobs.filter(j => j.parentId === job.parentId).findIndex(j => j.id === job.id);
              x = 430;
              y = 10 + siblingIdx * 80 + (parentIdx ?? 0) * 20;
            }

            return (
              <g
                key={job.id}
                className="cursor-pointer"
                onClick={() => onSelectJob(job.id)}
                style={{ cursor: "pointer" }}
              >
                {/* Node background */}
                <rect
                  x={x}
                  y={y}
                  width={140}
                  height={60}
                  rx={8}
                  fill={isSelected ? "#4c1d95" : "#e2e4ec"}
                  stroke={isSelected ? "#8b5cf6" : "#2e2e5a"}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {/* Status indicator */}
                <circle
                  cx={x + 12}
                  cy={y + 12}
                  r={5}
                  className={statusColor(job.status)}
                />
                {/* Specialist icon indicator */}
                {job.subagentDef && (
                  <text
                    x={x + 130}
                    y={y + 16}
                    textAnchor="end"
                    fill="#585866"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {job.subagentDef.replace("legal-", "")}
                  </text>
                )}
                {/* Job name */}
                <text
                  x={x + 12}
                  y={y + 32}
                  fill="#15151d"
                  fontSize={12}
                  fontWeight={600}
                >
                  {job.name === "supervisor" ? "Supervisor" : job.subagentDef?.replace("legal-", "").replace(/-/g, " ") || "subagent"}
                </text>
                {/* Job ID */}
                <text
                  x={x + 12}
                  y={y + 50}
                  fill="#8a8a98"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  #{job.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Job Detail Panel ─────────────────────────────────────────

function JobDetail({ job, allJobs, onRefresh }: { job: AgentJob; allJobs: AgentJob[]; onRefresh: () => Promise<void> }) {
  const children = allJobs.filter((j: AgentJob) => j.parentId === job.id);
  const [acting, setActing] = useState<string | null>(null);

  // Inbox state
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxInput, setInboxInput] = useState("");
  const [inboxSending, setInboxSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load inbox on mount / job change
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    (async () => {
      setInboxLoading(true);
      const msgs = await fetchInbox(job.id);
      if (!cancelled) setMessages(msgs);
      setInboxLoading(false);
    })();
    return () => { cancelled = true; };
  }, [job.id]);

  // Poll inbox while job is active
  useEffect(() => {
    if (job.status !== "active" && job.status !== "waiting") return;
    const interval = setInterval(async () => {
      const msgs = await fetchInbox(job.id);
      setMessages(prev => {
        // Merge: keep existing, append new by id
        const existing = new Set(prev.map(m => m.id));
        const novel = msgs.filter(m => !existing.has(m.id));
        return novel.length > 0 ? [...prev, ...novel] : prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [job.id, job.status]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSendMessage() {
    if (!inboxInput.trim()) return;
    setInboxSending(true);
    const msg = await sendInboxMessage(job.id, inboxInput.trim());
    setInboxSending(false);
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setInboxInput("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColor(job.status)}`} />
          <h3 className="text-lg font-semibold text-[#15151d]">
            {job.name === "supervisor" ? "Supervisor" : job.subagentDef?.replace("legal-", "").replace(/-/g, " ") || "Agent"}
          </h3>
          <span className="text-xs text-[#585866] font-mono">#{job.id}</span>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-[#e2e4ec] text-[#585866]">
          {statusLabel(job.status)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(job.status === "waiting" || job.status === "active") && (
          <button
            onClick={async () => {
              setActing("pause");
              await pauseJob(job.id);
              setActing(null);
              await onRefresh();
            }}
            disabled={acting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/15 text-amber-600 text-xs font-medium border border-amber-500/20 hover:bg-amber-600/25 disabled:opacity-40 transition-all"
          >
            {acting === "pause" ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />}
            Pausieren
          </button>
        )}
        {job.status === "paused" && (
          <button
            onClick={async () => {
              setActing("resume");
              await resumeJob(job.id);
              setActing(null);
              await onRefresh();
            }}
            disabled={acting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/15 text-emerald-600 text-xs font-medium border border-emerald-500/20 hover:bg-emerald-600/25 disabled:opacity-40 transition-all"
          >
            {acting === "resume" ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Fortsetzen
          </button>
        )}
        {(job.status === "waiting" || job.status === "active" || job.status === "paused") && (
          <button
            onClick={async () => {
              setActing("cancel");
              await cancelJob(job.id);
              setActing(null);
              await onRefresh();
            }}
            disabled={acting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/15 text-red-600 text-xs font-medium border border-red-500/20 hover:bg-red-600/25 disabled:opacity-40 transition-all"
          >
            {acting === "cancel" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
            Abbrechen
          </button>
        )}
        {(job.status === "completed" || job.status === "failed") && (
          <button
            onClick={async () => {
              setActing("replay");
              await replayJob(job.id);
              setActing(null);
              await onRefresh();
            }}
            disabled={acting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/15 text-violet-600 text-xs font-medium border border-violet-500/20 hover:bg-violet-600/25 disabled:opacity-40 transition-all"
          >
            {acting === "replay" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Neu starten
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
        <h4 className="text-xs font-semibold text-[#585866] uppercase tracking-wider mb-2">Prompt</h4>
        <p className="text-sm text-[#15151d] leading-relaxed">{job.prompt}</p>
      </div>

      {job.model && (
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-600" />
          <span className="text-sm text-[#585866]">Modell: <span className="text-[#15151d]">{job.model}</span></span>
        </div>
      )}

      {job.tokens && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#e2e4ec] bg-[#ffffff] p-3 text-center">
            <div className="text-lg font-mono font-semibold text-[#15151d]">{job.tokens.input.toLocaleString()}</div>
            <div className="text-xs text-[#585866]">Input Tokens</div>
          </div>
          <div className="rounded-lg border border-[#e2e4ec] bg-[#ffffff] p-3 text-center">
            <div className="text-lg font-mono font-semibold text-[#15151d]">{job.tokens.output.toLocaleString()}</div>
            <div className="text-xs text-[#585866]">Output Tokens</div>
          </div>
          <div className="rounded-lg border border-[#e2e4ec] bg-[#ffffff] p-3 text-center">
            <div className="text-lg font-mono font-semibold text-emerald-600">${job.cost?.toFixed(2) ?? "0.00"}</div>
            <div className="text-xs text-[#585866]">Kosten</div>
          </div>
        </div>
      )}

      {job.progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#585866]">{job.progress.message}</span>
            <span className="text-[#15151d] font-mono">{job.progress.step}/{job.progress.total}</span>
          </div>
          <div className="h-2 rounded-full bg-[#e2e4ec] overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${(job.progress.step / job.progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {job.result && (
        <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
          <h4 className="text-xs font-semibold text-[#585866] uppercase tracking-wider mb-2">Ergebnis</h4>
          <p className="text-sm text-[#15151d] leading-relaxed whitespace-pre-wrap">{job.result}</p>
        </div>
      )}

      {children.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[#585866] uppercase tracking-wider mb-2">Children</h4>
          <div className="space-y-2">
            {children.map(child => (
              <div key={child.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#ffffff] border border-[#e2e4ec]">
                <div className={`w-2 h-2 rounded-full ${statusColor(child.status)}`} />
                <span className="text-sm text-[#15151d]">{child.subagentDef?.replace("legal-", "") || "subagent"}</span>
                <span className="text-xs text-[#585866] font-mono">#{child.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbox / Chat Panel */}
      <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] flex flex-col" style={{ maxHeight: 380 }}>
        <div className="px-4 py-3 border-b border-[#e2e4ec] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-violet-600" />
            <h4 className="text-xs font-semibold text-[#585866] uppercase tracking-wider">Inbox</h4>
            {messages.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20">
                {messages.length}
              </span>
            )}
          </div>
          {inboxLoading && messages.length === 0 && (
            <Loader2 size={12} className="animate-spin text-[#585866]" />
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
          {messages.length === 0 && !inboxLoading && (
            <div className="text-center py-6">
              <Bot size={24} className="mx-auto text-[#e2e4ec] mb-2" />
              <p className="text-xs text-[#585866]">Noch keine Nachrichten.</p>
              <p className="text-[10px] text-[#74748a] mt-1">
                {job.status === "active" || job.status === "waiting"
                  ? "Schreibe dem Agenten eine Steuerungsnachricht."
                  : "Inbox ist nur für aktive Jobs verfügbar."}
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            const isSystem = msg.sender === "minions" || msg.sender === "system";
            const text = formatInboxPayload(msg.payload);
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2.5",
                  isUser ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  isUser ? "bg-violet-600/20" : isSystem ? "bg-amber-500/10" : "bg-emerald-500/10"
                )}>
                  {isUser ? <User size={12} className="text-violet-600" /> :
                    isSystem ? <Bot size={12} className="text-amber-600" /> :
                    <Bot size={12} className="text-emerald-600" />}
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                  isUser
                    ? "bg-violet-600/15 text-[#15151d] border border-violet-500/20"
                    : "bg-[#eceef3] text-[#585866] border border-[#e2e4ec]"
                )}>
                  <p className="leading-relaxed whitespace-pre-wrap break-words">{text}</p>
                  <span className="text-[10px] text-[#74748a] mt-1 block">
                    {new Date(msg.sent_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    {msg.read_at && <span className="ml-1">· gelesen</span>}
                  </span>
                </div>
              </div>
            );
          })}

          {inboxSending && (
            <div className="flex flex-row-reverse gap-2.5">
              <div className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0">
                <Loader2 size={12} className="text-violet-600 animate-spin" />
              </div>
              <div className="bg-violet-600/15 text-[#15151d] border border-violet-500/20 rounded-xl px-3 py-2 text-sm">
                <span className="text-[#585866]">Senden…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        {(job.status === "active" || job.status === "waiting" || job.status === "paused") && (
          <div className="p-3 border-t border-[#e2e4ec]">
            <div className="flex gap-2">
              <input
                value={inboxInput}
                onChange={(e) => setInboxInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                placeholder="Nachricht an Agenten…"
                aria-label="Nachricht an Agenten"
                disabled={inboxSending}
                className="flex-1 bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#74748a] focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={inboxSending || !inboxInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 transition-all"
              >
                {inboxSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Senden
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-[#585866]">
        {job.startedAt && <span>Gestartet: {new Date(job.startedAt).toLocaleString("de-DE")}</span>}
        {job.completedAt && <span>Fertig: {new Date(job.completedAt).toLocaleString("de-DE")}</span>}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function AgentsPage() {
  const { jobs, loading, refresh } = useAgents();
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "failed">("all");
  const [submitPrompt, setSubmitPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredJobs = useMemo(() => {
    if (filter === "all") return jobs;
    return jobs.filter((j: AgentJob) => j.status === filter);
  }, [jobs, filter]);

  const selectedJobData = useMemo(() =>
    jobs.find((j: AgentJob) => j.id === selectedJob) ?? null,
  [jobs, selectedJob]);

  const activeCount = jobs.filter((j: AgentJob) => j.status === "active").length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submitPrompt.trim()) return;
    setSubmitting(true);
    const jobId = await submitSupervisor(submitPrompt.trim());
    setSubmitting(false);
    if (jobId) {
      setSubmitPrompt("");
      setSelectedJob(jobId);
      await refresh();
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left: Job List + Submit */}
      <div className="w-80 border-r border-[#e2e4ec] bg-[#ffffff] flex flex-col">
        {/* Workflow Templates */}
        <div className="p-4 border-b border-[#e2e4ec] space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-violet-600" />
            <span className="text-xs font-semibold text-[#15151d]">Workflow Templates</span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Due Diligence", prompt: "Führe eine Due Diligence Prüfung durch. Identifiziere Risiken, Haftungsklauseln, fehlende Standardklauseln und bewerte den Gesamtrisiko-Score. Nutze alle verfügbaren Verträge und Dokumente.", icon: "🔍" },
              { label: "Vertrags-Review", prompt: "Analysiere alle Verträge im Vault nach deutschem Recht. Erstelle eine Klauselmatrix, identifiziere rote Flaggen, und empfehle konkrete Änderungen. Prüfe AGB-Konformität und DSGVO-Klauseln.", icon: "📋" },
              { label: "Litigation Prep", prompt: "Bereite die Litigation vor. Analysiere den Sachverhalt, identifiziere relevante Gesetze und Präzedenzfälle, erstelle eine Chancen-Risiko-Bewertung, und entwirf eine Beweisstrategie.", icon: "⚖️" },
              { label: "Compliance-Check", prompt: "Führe einen vollständigen Compliance-Check durch. Prüfe DSGVO-Konformität, GwG-Vorgaben, GOBD-Anforderungen, und identifiziere Handlungsbedarf mit Priorisierung.", icon: "✅" },
              { label: "Kanzlei-Wissen extrahieren", prompt: "Durchsuche alle Akten und Dokumente der Kanzlei nach wiederkehrenden Mustern, erfolgreichen Strategien, und extrahiere Lessons Learned als Wissensbasis.", icon: "🧠" },
            ].map((template) => (
              <button
                key={template.label}
                onClick={() => { setSubmitPrompt(template.prompt); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#ffffff] border border-[#e2e4ec] text-xs text-[#585866] hover:border-violet-500/30 hover:text-[#15151d] transition-all"
              >
                <span className="mr-1.5">{template.icon}</span>
                {template.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Form */}
        <div className="p-4 border-b border-[#e2e4ec]">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-violet-600" />
              <span className="text-xs font-semibold text-[#15151d]">Neuer Supervisor</span>
            </div>
            <input
              value={submitPrompt}
              onChange={e => setSubmitPrompt(e.target.value)}
              placeholder="Beschreibe die Aufgabe..."
              aria-label="Beschreibe die Aufgabe..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#ffffff] border border-[#e2e4ec] text-xs text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/40"
            />
            <button
              type="submit"
              disabled={submitting || !submitPrompt.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-600 text-xs font-medium border border-violet-500/20 hover:bg-violet-600/30 disabled:opacity-40 transition-all"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? "Starte..." : "Starten"}
            </button>
          </form>
        </div>

        {/* Header */}
        <div className="p-4 border-b border-[#e2e4ec]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#15151d]">Agent Jobs</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-[#585866]">{activeCount} aktiv</span>
            </div>
          </div>

          <div className="flex gap-1">
            {(["all", "active", "completed", "failed"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-all",
                  filter === f
                    ? "bg-violet-600/20 text-violet-600 border border-violet-500/20"
                    : "text-[#585866] hover:text-[#585866] hover:bg-[#eceef3]"
                )}
              >
                {f === "all" ? "Alle" : f === "active" ? "Aktiv" : f === "completed" ? "Fertig" : "Fehler"}
              </button>
            ))}
          </div>
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && jobs.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-violet-600 animate-spin" />
            </div>
          )}
          {filteredJobs.map((job: AgentJob) => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                selectedJob === job.id
                  ? "bg-violet-600/10 border-violet-500/20"
                  : "bg-[#ffffff] border-[#e2e4ec] hover:border-[#2e2e5a]"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                {statusIcon(job.status)}
                <span className="text-xs font-medium text-[#15151d]">
                  {job.name === "supervisor" ? "Supervisor" : job.subagentDef?.replace("legal-", "") || "subagent"}
                </span>
                <span className="text-[10px] text-[#585866] font-mono ml-auto">#{job.id}</span>
              </div>
              <p className="text-xs text-[#585866] line-clamp-2">{job.prompt}</p>
              {job.progress && (
                <div className="mt-2 h-1 rounded-full bg-[#e2e4ec] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${(job.progress.step / job.progress.total) * 100}%` }}
                  />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Middle: DAG Visualization */}
      <div className="flex-1 flex flex-col bg-[#f5f6f9] overflow-hidden">
        <div className="p-4 border-b border-[#e2e4ec] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-violet-600" />
            <h2 className="text-sm font-semibold text-[#15151d]">Agent DAG</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => refresh()}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[#585866] hover:text-[#15151d] hover:bg-[#eceef3] transition-all"
            >
              <RefreshCw size={12} />
              Aktualisieren
            </button>
            <div className="flex items-center gap-3 text-xs text-[#585866]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Fertig</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Aktiv</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Wartend</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Fehler</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <AgentDAG
            jobs={jobs}
            selectedJob={selectedJob}
            onSelectJob={setSelectedJob}
          />
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div className="w-96 border-l border-[#e2e4ec] bg-[#ffffff] overflow-y-auto">
        <div className="p-4 border-b border-[#e2e4ec]">
          <h2 className="text-sm font-semibold text-[#15151d]">Details</h2>
        </div>
        <div className="p-4">
          {selectedJobData ? (
            <JobDetail
              job={selectedJobData}
              allJobs={jobs}
              onRefresh={refresh}
            />
          ) : (
            <div className="text-center py-12">
              <Bot size={32} className="mx-auto text-[#e2e4ec] mb-3" />
              <p className="text-sm text-[#585866]">Wähle einen Job aus der Liste</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
