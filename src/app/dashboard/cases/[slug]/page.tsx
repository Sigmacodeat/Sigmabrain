"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Briefcase,
  Loader2,
  ArrowLeft,
  FileText,
  CalendarClock,
  Network,
  Scale,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  MessageSquare,
  Send,
  Copy,
  Check,
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  ListChecks,
  Timer,
  Receipt,
  Plus,
  Trash2,
  Landmark,
  User,
  Play,
  Square,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { isOnline, enqueueMutation } from "@/lib/offline-store";
import type { BrainPage } from "@/lib/types";
import { CitationLink, parseCitations } from "@/components/legal/CitationLink";
import CommentThread from "@/components/legal/CommentThread";
import { cn } from "@/lib/utils";
import { STATUS_TEXT, STATUS_BG, STATUS_BORDER, statusBadgeClasses, type StatusColor } from "@/lib/status-colors";
import { caseFrontmatter, type EvidenceEntry, type StrategyInfo, type TaskEntry, type TimeEntry, type TimelineEntry, type DocumentEntry, type DeadlineEntry, type ExpenseEntry, type AuditLogEntry } from "@/lib/legal-types";
import { DEADLINE_RULES, calculateDeadline, computeDeadlineStatus, timelineToDeadline, withDeadlineAudit } from "@/lib/legal-deadlines";

interface CaseDetail {
  slug: string;
  title: string;
  caseNumber: string;
  status: string;
  legalArea: string;
  subArea?: string;
  priority: string;
  opponentId?: string;
  opponentName?: string;
  ownLawyerId?: string;
  ownLawyerName?: string;
  ownLawyerSlug?: string;
  courtId?: string;
  courtName?: string;
  clientId?: string;
  clientName?: string;
  clientSlug?: string;
  opponentSlugs?: string[];
  courtSlug?: string;
  facts: string;
  claims: string[];
  defenses: string[];
  evidence: EvidenceEntry[];
  strategy?: StrategyInfo;
  outcome?: Record<string, unknown>;
  estimatedValue?: { min: number; max: number; currency: string };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  tasks: TaskEntry[];
  timeEntries: TimeEntry[];
  expenses: ExpenseEntry[];
  timelineEvents: TimelineEntry[];
  documents: DocumentEntry[];
  deadlines: DeadlineEntry[];
  portalEnabled: boolean;
  portalNote?: string;
  auditLog?: AuditLogEntry[];
  version: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: StatusColor }> = {
  open: { label: "Offen", icon: Clock, color: "blue" },
  pending: { label: "Anhängig", icon: PauseCircle, color: "amber" },
  settled: { label: "Erledigt", icon: CheckCircle2, color: "emerald" },
  won: { label: "Gewonnen", icon: CheckCircle2, color: "emerald" },
  lost: { label: "Verloren", icon: XCircle, color: "red" },
  appealed: { label: "Berufung", icon: AlertTriangle, color: "orange" },
  dormant: { label: "Ruhend", icon: PauseCircle, color: "gray" },
};

const TABS = [
  { key: "overview", label: "Übersicht", icon: FileText },
  { key: "timeline", label: "Timeline", icon: CalendarClock },
  { key: "documents", label: "Dokumente", icon: FileText },
  { key: "deadlines", label: "Fristen", icon: CalendarClock },
  { key: "tasks", label: "Aufgaben", icon: ListChecks },
  { key: "evidence", label: "Beweismittel", icon: ShieldAlert },
  { key: "time", label: "Zeit", icon: Timer },
  { key: "expenses", label: "Auslagen", icon: Receipt },
  { key: "graph", label: "Graph", icon: Network },
  { key: "audit", label: "Audit", icon: ShieldCheck },
  { key: "query", label: "Query", icon: MessageSquare },
];

function parseCaseDetail(page: BrainPage): CaseDetail {
  const fm = caseFrontmatter(page);
  return {
    slug: page.slug,
    title: page.title,
    caseNumber: fm.case_number || page.slug,
    status: fm.status || "open",
    legalArea: fm.legal_area || "",
    subArea: fm.sub_area || undefined,
    priority: fm.priority || "medium",
    opponentId: fm.opponent_id || undefined,
    opponentName: fm.opponent_name || undefined,
    ownLawyerId: fm.own_lawyer_id || undefined,
    ownLawyerName: fm.own_lawyer_name || undefined,
    ownLawyerSlug: fm.own_lawyer_slug || undefined,
    courtId: fm.court_id || undefined,
    courtName: fm.court_name || undefined,
    clientId: fm.client_id || undefined,
    clientName: fm.client_name || undefined,
    clientSlug: fm.client_slug || undefined,
    opponentSlugs: fm.opponent_slugs || undefined,
    courtSlug: fm.court_slug || undefined,
    facts: page.content || "",
    claims: fm.claims || [],
    defenses: fm.defenses || [],
    evidence: fm.evidence || [],
    strategy: fm.strategy || undefined,
    outcome: fm.outcome || undefined,
    estimatedValue: fm.estimated_value || undefined,
    tags: fm.tags || [],
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    tasks: fm.tasks || [],
    timeEntries: fm.time_entries || [],
    expenses: fm.expenses || [],
    timelineEvents: fm.timeline_events || [],
    documents: fm.documents || [],
    deadlines: fm.deadlines || [],
    portalEnabled: fm.portal_enabled || false,
    portalNote: fm.portal_note || undefined,
    auditLog: (fm.audit_log || []) as AuditLogEntry[],
    version: (fm.version as number) || 0,
  };
}

export default function CaseDetailPage() {
  const params = useParams();
  const slug = decodeURIComponent(params.slug as string);
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [generatingPortal, setGeneratingPortal] = useState(false);
  const [userRole, setUserRole] = useState<string>("lawyer");
  const [currentUserName, setCurrentUserName] = useState<string>("System");
  const [currentUserId, setCurrentUserId] = useState<string>("system");
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Tasks state
  const [tasks, setTasks] = useState<Array<{ id: string; text: string; done: boolean; createdAt: string }>>([]);
  const [newTask, setNewTask] = useState("");

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timerDescription, setTimerDescription] = useState("");
  const [timerMinutes, setTimerMinutes] = useState("");
  const [timerRate, setTimerRate] = useState("200");
  const [timerLawyer, setTimerLawyer] = useState("");
  const [timerActivity, setTimerActivity] = useState("Beratung");
  const [timerBillable, setTimerBillable] = useState(true);

  // Live timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartAt, setTimerStartAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [expensesList, setExpensesList] = useState<ExpenseEntry[]>([]);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseBillable, setExpenseBillable] = useState(true);

  // Contacts linked to this case
  const [contacts, setContacts] = useState<{ slug: string; name: string; role: string }[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Evidence CRUD state
  const [evidenceList, setEvidenceList] = useState<EvidenceEntry[]>([]);
  const [evidenceForm, setEvidenceForm] = useState<EvidenceEntry>({});
  const [editingEvidenceIndex, setEditingEvidenceIndex] = useState<number | null>(null);

  // Deadlines CRUD state
  const [deadlinesList, setDeadlinesList] = useState<DeadlineEntry[]>([]);
  const [deadlineForm, setDeadlineForm] = useState<DeadlineEntry>({});
  const [editingDeadlineIndex, setEditingDeadlineIndex] = useState<number | null>(null);
  const [deadlineRuleKey, setDeadlineRuleKey] = useState(DEADLINE_RULES[0].key);
  const [deadlineStartDate, setDeadlineStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [aiDetectText, setAiDetectText] = useState("");
  const [aiDetecting, setAiDetecting] = useState(false);
  const [aiDetectedDeadlines, setAiDetectedDeadlines] = useState<Array<{ title: string; date: string; type: string; confidence: number }>>([]);

  // Live timer interval
  useEffect(() => {
    if (!timerRunning || !timerStartAt) return;
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - timerStartAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerStartAt]);

  // Initialize from brain page
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setContactsLoading(true);
      try {
        const meRes = await fetch("/api/auth/me").then((r) => r.json()).catch(() => null);
        if (meRes?.user?.role && !cancelled) setUserRole(meRes.user.role);
        if (meRes?.user?.name && !cancelled) setCurrentUserName(meRes.user.name);
        if (meRes?.user?.id && !cancelled) setCurrentUserId(meRes.user.id);

        const [page, allContacts] = await Promise.all([
          api.brain.getPage(slug),
          api.brain.listPages({ type: "legal_contact", limit: 200 }).catch(() => [] as BrainPage[]),
        ]);
        if (!cancelled) {
          const detail = parseCaseDetail(page);
          setCaseData(detail);
          setTasks(detail.tasks);
          setTimeEntries(detail.timeEntries);
          setExpensesList(detail.expenses);
          setTimerLawyer(detail.ownLawyerName || "");
          setEvidenceList(detail.evidence || []);
          setDeadlinesList(detail.deadlines.length > 0 ? detail.deadlines : detail.timelineEvents.map((entry) => timelineToDeadline(entry, detail.slug)));
          setContacts(allContacts.map((p) => {
            const fm = p.frontmatter as Record<string, unknown>;
            return {
              slug: p.slug,
              name: String(fm.name ?? p.title ?? ""),
              role: String(fm.role ?? "other"),
            };
          }));
        }
      } catch (err) {
        console.error("[case-detail] failed to load case:", err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setContactsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Live sync: poll every 30s and warn if version changed
  useEffect(() => {
    if (!caseData) return;
    const id = setInterval(async () => {
      try {
        const page = await api.brain.getPage(slug);
        const fm = caseFrontmatter(page);
        const remoteVersion = (fm.version as number) || 0;
        if (remoteVersion > caseData.version) {
          setConflictWarning(`Diese Akte wurde gerade von einem anderen Nutzer bearbeitet (Version ${remoteVersion}). Bitte aktualisieren.`);
        }
      } catch {
        // ignore polling errors
      }
    }, 30000);
    return () => clearInterval(id);
  }, [caseData?.version, slug]);

  // Auto-save tasks and time entries back to brain page
  async function saveCaseUpdate(updates: Partial<CaseDetail>) {
    if (!caseData) return;
    try {
      // Build audit entry from update keys
      const changedFields = Object.keys(updates).filter((k) => k !== "auditLog");
      const auditEntry = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        action: "updated" as const,
        actor: currentUserName,
        field: changedFields.join(", ") || "general",
        note: changedFields.includes("tasks") ? "Aufgaben bearbeitet"
          : changedFields.includes("timeEntries") ? "Zeiterfassung bearbeitet"
          : changedFields.includes("expenses") ? "Auslagen bearbeitet"
          : changedFields.includes("deadlines") ? "Fristen bearbeitet"
          : changedFields.includes("evidence") ? "Beweismittel bearbeitet"
          : changedFields.includes("documents") ? "Dokumente bearbeitet"
          : changedFields.includes("status") ? "Status geändert"
          : "Akte bearbeitet",
      };
      const existingAudit = caseData.auditLog ?? [];
      const newAudit = [...existingAudit, auditEntry];

      const frontmatter: Record<string, unknown> = {
        type: "legal_case",
        case_number: caseData.caseNumber,
        status: caseData.status,
        legal_area: caseData.legalArea,
        priority: caseData.priority,
        opponent_name: caseData.opponentName,
        opponent_slugs: updates.opponentSlugs ?? caseData.opponentSlugs,
        client_name: caseData.clientName,
        client_slug: updates.clientSlug ?? caseData.clientSlug,
        court_name: caseData.courtName,
        court_slug: updates.courtSlug ?? caseData.courtSlug,
        own_lawyer_name: caseData.ownLawyerName,
        own_lawyer_slug: updates.ownLawyerSlug ?? caseData.ownLawyerSlug,
        claims: caseData.claims,
        defenses: caseData.defenses,
        tags: caseData.tags,
        tasks: updates.tasks ?? tasks,
        time_entries: updates.timeEntries ?? timeEntries,
        expenses: updates.expenses ?? expensesList,
        timeline_events: updates.timelineEvents ?? caseData.timelineEvents,
        documents: updates.documents ?? caseData.documents,
        evidence: updates.evidence ?? evidenceList,
        deadlines: updates.deadlines ?? deadlinesList,
        portal_enabled: updates.portalEnabled ?? caseData.portalEnabled,
        portal_note: updates.portalNote ?? caseData.portalNote,
        audit_log: newAudit,
        version: (caseData.version || 0) + 1,
      };
      if (isOnline()) {
        await api.brain.updatePage({
          slug: caseData.slug,
          title: caseData.title,
          content: caseData.facts,
          frontmatter,
        });
      } else {
        await enqueueMutation({
          type: "updatePage",
          payload: {
            slug: caseData.slug,
            title: caseData.title,
            content: caseData.facts,
            frontmatter,
          },
        });
      }
      setSaveError(null);
    } catch (e) {
      // Speicherfehler MÜSSEN sichtbar sein — sonst verschwinden Tasks und
      // Zeiteinträge beim nächsten Reload kommentarlos.
      setSaveError(e instanceof Error
        ? `Speichern fehlsgeschlagen: ${e.message}`
        : "Speichern fehlgeschlagen — Änderungen sind nur lokal sichtbar.");
    }
  }

  async function handleQuery() {
    if (!query.trim() || !caseData) return;
    setQueryLoading(true);
    setQueryResult(null);
    try {
      const res = await api.query.think(
        `Im Kontext der Akte "${caseData.title}" (${caseData.caseNumber}): ${query}`
      );
      setQueryResult(res.answer);
    } catch {
      setQueryResult("Fehler bei der Abfrage. Bitte versuche es erneut.");
    } finally {
      setQueryLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="text-violet-600 animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Briefcase size={48} className="text-[#e2e4ec]" />
        <p className="text-[#585866]">Akte nicht gefunden</p>
        <Link href="/dashboard/cases">
          <Button variant="primary" className="bg-violet-600 hover:bg-violet-500 text-white gap-2">
            <ArrowLeft size={16} />
            Zurück zu den Akten
          </Button>
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[caseData.status] || STATUS_CONFIG.open;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="h-full flex flex-col">
      {/* Save errors must be visible (tasks/time entries would silently vanish) */}
      <div aria-live="assertive">
        {saveError && (
          <div className="flex items-center gap-2 px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-600" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            {saveError}
          </div>
        )}
        {conflictWarning && (
          <div className="flex items-center gap-2 px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-sm text-amber-600" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            {conflictWarning}
            <button
              onClick={() => window.location.reload()}
              className="ml-auto text-xs text-violet-600 hover:underline"
            >
              Jetzt aktualisieren
            </button>
          </div>
        )}
      </div>
      {/* Header */}
      <div className="shrink-0 border-b border-[#e2e4ec] bg-[#ffffff] px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Link href="/dashboard/cases" aria-label="Zurück zur Aktenliste" className="text-[#585866] hover:text-[#585866] transition-colors">
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <span className="text-xs text-[#585866]">Akten</span>
          <ChevronRight size={12} className="text-[#585866]" />
          <span className="text-xs text-[#585866] font-mono">{caseData.caseNumber}</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", STATUS_BG[statusCfg.color], STATUS_BORDER[statusCfg.color])} aria-hidden="true">
              <StatusIcon size={22} className={STATUS_TEXT[statusCfg.color]} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#15151d]">{caseData.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default" className={cn("text-[10px] border",
                  caseData.priority === "critical" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                  caseData.priority === "high" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                  caseData.priority === "low" ? "bg-gray-500/10 text-gray-400 border-gray-500/20" :
                  "bg-blue-500/10 text-blue-600 border-blue-500/20"
                )}>
                  {caseData.priority}
                </Badge>
                {caseData.legalArea && (
                  <span className="text-xs text-[#585866] flex items-center gap-1">
                    <Scale size={10} />{caseData.legalArea}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="default" className={cn("text-xs border", statusBadgeClasses(statusCfg.color))}>
              {statusCfg.label}
            </Badge>
            {caseData.estimatedValue && (
              <p className="text-xs text-[#585866] mt-1">
                Streitwert: {caseData.estimatedValue.min.toLocaleString()}–{caseData.estimatedValue.max.toLocaleString()} {caseData.estimatedValue.currency}
              </p>
            )}
          </div>
        </div>

        {/* Meta bar */}
        <div className="flex items-center gap-4 mt-3 text-xs text-[#585866] flex-wrap">
          {caseData.clientName && (
            <span className="flex items-center gap-1">
              <Users size={10} />Mandant:{" "}
              {caseData.clientSlug ? (
                <Link href={`/dashboard/contacts?highlight=${encodeURIComponent(caseData.clientSlug)}`} className="text-violet-600 hover:underline">{caseData.clientName}</Link>
              ) : (
                <span className="text-[#585866]">{caseData.clientName}</span>
              )}
            </span>
          )}
          {caseData.opponentName && (
            <span className="flex items-center gap-1"><ShieldAlert size={10} />Gegner: <span className="text-[#585866]">{caseData.opponentName}</span></span>
          )}
          {caseData.courtName && (
            <span className="flex items-center gap-1"><Briefcase size={10} />Gericht: <span className="text-[#585866]">{caseData.courtName}</span></span>
          )}
          {caseData.ownLawyerName && (
            <span className="flex items-center gap-1"><Users size={10} />Anwalt: <span className="text-[#585866]">{caseData.ownLawyerName}</span></span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-[#e2e4ec] bg-[#ffffff] px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                  activeTab === tab.key
                    ? "border-violet-400 text-violet-600"
                    : "border-transparent text-[#585866] hover:text-[#15151d]"
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === "overview" && (
          <div className="space-y-4 max-w-3xl">
            {/* Quick Actions */}
	            <div className="flex gap-2">
              <Button
                variant="primary"
                className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
                onClick={() => { setActiveTab("query"); setQuery("Welche Strategie empfiehlst du für diese Akte?"); }}
              >
                <Lightbulb size={14} />
                Strategie generieren
              </Button>
	              <Button
	                variant="secondary"
                className="bg-[#eceef3] border border-[#e2e4ec] text-[#15151d] hover:bg-[#1a1a3a] gap-2 text-sm"
                onClick={() => { setActiveTab("query"); setQuery("Bewerte die Erfolgsaussichten dieser Akte."); }}
              >
                <Scale size={14} />
	                Chancen bewerten
	              </Button>
                {(userRole === "admin" || userRole === "lawyer") && (
                  <>
                    <Button
                      variant="secondary"
                      className={cn(
                        "border text-sm",
                        caseData.portalEnabled
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/15"
                          : "bg-[#eceef3] border-[#e2e4ec] text-[#15151d] hover:bg-[#1a1a3a]"
                      )}
                      onClick={() => {
                        const updated = { ...caseData, portalEnabled: !caseData.portalEnabled };
                        setCaseData(updated);
                        saveCaseUpdate({
                          ...updated,
                        });
                      }}
                    >
                      {caseData.portalEnabled ? "Portal freigegeben" : "Für Portal freigeben"}
                    </Button>
                    {caseData.portalEnabled && (
                      <Button
                        variant="secondary"
                        className="bg-[#eceef3] border border-[#e2e4ec] text-[#15151d] hover:bg-[#1a1a3a] gap-2 text-sm"
                        onClick={async () => {
                          setGeneratingPortal(true);
                          try {
                            const res = await fetch("/api/portal/generate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ caseSlug: caseData.slug }),
                            });
                            const data = await res.json();
                            if (res.ok && data.url) {
                              const fullUrl = `${window.location.origin}${data.url}`;
                              setPortalUrl(fullUrl);
                              await navigator.clipboard.writeText(fullUrl);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            } else {
                              setSaveError("Portal-Link konnte nicht generiert werden.");
                            }
                          } catch (err) {
                            console.error("[portal] generate failed:", err instanceof Error ? err.message : String(err));
                            setSaveError("Portal-Link konnte nicht generiert werden.");
                          } finally {
                            setGeneratingPortal(false);
                          }
                        }}
                        disabled={generatingPortal}
                      >
                        {generatingPortal ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                        {generatingPortal ? "Wird erstellt…" : copied ? "Link kopiert!" : "Portal-Link"}
                      </Button>
                    )}
                  </>
                )}
	            </div>

                {/* Portal link display */}
                {portalUrl && (userRole === "admin" || userRole === "lawyer") && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                    <p className="text-xs text-emerald-600 font-medium mb-1">Portal-Link (30 Tage gültig)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-[#585866] flex-1 break-all">{portalUrl}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className="text-xs text-violet-600 hover:underline shrink-0"
                      >
                        {copied ? "Kopiert" : "Kopieren"}
                      </button>
                      <button
                        onClick={async () => {
                          const token = portalUrl.split("/portal/")[1];
                          if (!token) return;
                          try {
                            const res = await fetch("/api/portal/revoke", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ token }),
                            });
                            if (res.ok) {
                              setPortalUrl(null);
                              setSaveError(null);
                            } else {
                              setSaveError("Portal-Link konnte nicht widerrufen werden.");
                            }
                          } catch {
                            setSaveError("Portal-Link konnte nicht widerrufen werden.");
                          }
                        }}
                        className="text-xs text-red-600 hover:underline shrink-0"
                      >
                        Widerrufen
                      </button>
                    </div>
                  </div>
                )}

            {/* Stammdaten — Kontakte verknüpfen */}
            <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#15151d]">Stammdaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Client */}
                <div className="space-y-1">
                  <label className="text-xs text-[#585866]">Mandant</label>
                  <select
                    value={caseData.clientSlug || ""}
                    onChange={(e) => {
                      const selected = contacts.find((c) => c.slug === e.target.value);
                      const updated: CaseDetail = { ...caseData, clientSlug: e.target.value || undefined, clientName: selected?.name ?? caseData.clientName };
                      setCaseData(updated);
                      saveCaseUpdate({ clientSlug: updated.clientSlug, clientName: updated.clientName });
                    }}
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="">— Auswählen —</option>
                    {contacts.filter((c) => c.role === "client").map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {/* Opponent */}
                <div className="space-y-1">
                  <label className="text-xs text-[#585866]">Gegner</label>
                  <select
                    value={(caseData.opponentSlugs ?? [])[0] || ""}
                    onChange={(e) => {
                      const selected = contacts.find((c) => c.slug === e.target.value);
                      const slugs = e.target.value ? [e.target.value] : undefined;
                      const updated: CaseDetail = { ...caseData, opponentSlugs: slugs, opponentName: selected?.name ?? caseData.opponentName };
                      setCaseData(updated);
                      saveCaseUpdate({ opponentSlugs: updated.opponentSlugs, opponentName: updated.opponentName });
                    }}
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="">— Auswählen —</option>
                    {contacts.filter((c) => c.role === "opponent").map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {/* Court */}
                <div className="space-y-1">
                  <label className="text-xs text-[#585866]">Gericht</label>
                  <select
                    value={caseData.courtSlug || ""}
                    onChange={(e) => {
                      const selected = contacts.find((c) => c.slug === e.target.value);
                      const updated: CaseDetail = { ...caseData, courtSlug: e.target.value || undefined, courtName: selected?.name ?? caseData.courtName };
                      setCaseData(updated);
                      saveCaseUpdate({ courtSlug: updated.courtSlug, courtName: updated.courtName });
                    }}
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="">— Auswählen —</option>
                    {contacts.filter((c) => c.role === "court").map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {contactsLoading && (
                <p className="text-xs text-[#585866]">Kontakte werden geladen…</p>
              )}
              {contacts.length === 0 && !contactsLoading && (
                <p className="text-xs text-amber-600">
                  Noch keine Kontakte angelegt.{" "}
                  <Link href="/dashboard/contacts" className="text-violet-600 hover:underline">Kontakt anlegen →</Link>
                </p>
              )}
            </div>

            {/* Facts */}
            {caseData.facts && (
              <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
                <h3 className="text-sm font-semibold text-[#15151d] mb-2">Sachverhalt</h3>
                <div className="text-sm text-[#585866] whitespace-pre-wrap leading-relaxed">
                  {parseCitations(caseData.facts).map((segment, i) =>
                    segment.isCitation ? (
                      <CitationLink key={i} citation={segment.text} />
                    ) : (
                      <span key={i}>{segment.text}</span>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Claims */}
            {caseData.claims.length > 0 && (
              <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
                <h3 className="text-sm font-semibold text-[#15151d] mb-2">Ansprüche / Klageanträge</h3>
                <ul className="space-y-1.5">
                  {caseData.claims.map((claim, i) => (
                    <li key={i} className="text-sm text-[#585866] flex items-start gap-2">
                      <span className="text-violet-600 mt-0.5">•</span>
                      {claim}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Defenses */}
            {caseData.defenses.length > 0 && (
              <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
                <h3 className="text-sm font-semibold text-[#15151d] mb-2">Verteidigung / Einwände</h3>
                <ul className="space-y-1.5">
                  {caseData.defenses.map((def, i) => (
                    <li key={i} className="text-sm text-[#585866] flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      {def}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Strategy */}
            {caseData.strategy && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-4">
                <h3 className="text-sm font-semibold text-violet-600 mb-2">Empfohlene Strategie</h3>
                <p className="text-sm text-[#585866] mb-3">{caseData.strategy.recommended}</p>
                {caseData.strategy.risks && caseData.strategy.risks.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-red-600 mb-1">Risiken</h4>
                    <ul className="space-y-1">
                      {(caseData.strategy.risks ?? []).map((r, i) => (
                        <li key={i} className="text-xs text-[#585866]">
                          • {r.description} ({r.probability} / {r.impact})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {caseData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {caseData.tags.map((tag) => (
                  <Badge key={tag} variant="default" className="text-[10px] bg-[#eceef3] border border-[#e2e4ec] text-[#585866]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="primary"
                className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
                onClick={() => { setActiveTab("query"); setQuery("Erstelle eine Timeline für diese Akte mit allen wichtigen Ereignissen."); }}
              >
                <CalendarClock size={14} />
                Timeline generieren
              </Button>
            </div>
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-[#e2e4ec]" />
              {/* Creation */}
              <div className="relative">
                <div className="absolute -left-4 w-2 h-2 rounded-full bg-violet-500" />
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3">
                  <div className="text-xs text-[#585866]">{new Date(caseData.createdAt).toLocaleDateString("de-DE")}</div>
                  <div className="text-sm text-[#15151d]">Akte erstellt</div>
                  <div className="text-xs text-[#585866]">{caseData.caseNumber}</div>
                </div>
              </div>
              {/* Dynamic timeline events from frontmatter */}
              {caseData.timelineEvents?.map((ev) => (
                <div key={ev.id} className="relative">
                  <div className={`absolute -left-4 w-2 h-2 rounded-full ${
                    ev.type === "deadline" ? "bg-amber-500" :
                    ev.type === "hearing" ? "bg-blue-500" :
                    ev.type === "filing" ? "bg-emerald-500" :
                    ev.type === "status_change" ? "bg-violet-500" :
                    "bg-[#8a8a98]"
                  }`} />
                  <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3">
                    <div className="text-xs text-[#585866]">{ev.date ? new Date(ev.date).toLocaleDateString("de-DE") : "—"}</div>
                    <div className="text-sm text-[#15151d]">{ev.title}</div>
                    {ev.description && <div className="text-xs text-[#585866]">{ev.description}</div>}
                  </div>
                </div>
              ))}
              {/* Status changes */}
              {caseData.status !== "open" && (
                <div className="relative">
                  <div className="absolute -left-4 w-2 h-2 rounded-full bg-amber-500" />
                  <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3">
                    <div className="text-xs text-[#585866]">{new Date(caseData.updatedAt).toLocaleDateString("de-DE")}</div>
                    <div className="text-sm text-[#15151d]">Status geändert: {STATUS_CONFIG[caseData.status]?.label || caseData.status}</div>
                  </div>
                </div>
              )}
              {/* Strategy generated */}
              {caseData.strategy && (
                <div className="relative">
                  <div className="absolute -left-4 w-2 h-2 rounded-full bg-emerald-500" />
                  <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3">
                    <div className="text-xs text-[#585866]">{new Date(caseData.strategy.generatedAt || caseData.updatedAt).toLocaleDateString("de-DE")}</div>
                    <div className="text-sm text-[#15151d]">Strategie generiert</div>
                    <div className="text-xs text-[#585866]">{caseData.strategy.recommendedApproach}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !caseData) return;
                    if (!isOnline()) {
                      setUploadError("Offline — Datei-Upload erfordert Internetverbindung.");
                      return;
                    }
                    try {
                      const res = await api.upload.file(file, { title: file.name, source: "legal_case", tags: [caseData.slug] });
                      const updated = [...caseData.documents, { id: Date.now().toString(), name: file.name, url: res.slug, uploadedAt: new Date().toISOString(), size: file.size }];
                      setCaseData({ ...caseData, documents: updated });
                      saveCaseUpdate({ documents: updated });
                      setUploadError(null);
                    } catch (err) {
                      setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
                    }
                  }}
                />
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors cursor-pointer">
                  <Plus size={14} /> Dokument hochladen
                </span>
              </label>
            </div>

            {uploadError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">
                {uploadError}
              </div>
            )}

            {caseData.documents.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <FileText size={48} className="mx-auto text-[#e2e4ec]" />
                <p className="text-[#585866]">Noch keine Dokumente zugeordnet.</p>
                <p className="text-[#585866] text-sm">Nutze den Upload-Button um Verträge, Gutachten oder Schriftsätze anzuhängen.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {caseData.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#e2e4ec] bg-[#ffffff]">
                    <FileText size={16} className="text-violet-600 shrink-0" />
	                    <div className="flex-1 min-w-0">
	                      <div className="text-sm text-[#15151d] truncate">{doc.name}</div>
	                      <div className="text-xs text-[#585866]">
                          {new Date(doc.uploadedAt).toLocaleDateString("de-DE")}
                          {doc.size ? ` · ${(doc.size / 1024).toFixed(0)} KB` : ""}
                          {doc.kind ? ` · ${doc.kind}` : ""}
                        </div>
	                    </div>
                      {(doc.slug || doc.url) && (
                        <Link
                          href={`/dashboard/brain/${encodeURIComponent(doc.slug || doc.url || "")}`}
                          className="text-[#585866] hover:text-violet-600 transition-colors px-2 py-1 text-xs"
                        >
                          Öffnen
                        </Link>
                      )}
	                    <button
                      onClick={() => {
                        const updated = caseData.documents.filter((d) => d.id !== doc.id);
                        setCaseData({ ...caseData, documents: updated });
                        saveCaseUpdate({ documents: updated });
                      }}
                      className="text-[#585866] hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "deadlines" && (
          <div className="max-w-3xl space-y-4">
            {/* Add/Edit Form */}
            <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#15151d]">
                {editingDeadlineIndex !== null ? "Frist bearbeiten" : "Frist / Termin hinzufügen"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#585866] mb-1">Titel</label>
                  <input
                    value={deadlineForm.title || ""}
                    onChange={(e) => setDeadlineForm({ ...deadlineForm, title: e.target.value })}
                    placeholder="z.B. Klageerwiderung"
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#585866] mb-1">Fälligkeitsdatum</label>
                  <input
                    type="date"
                    value={deadlineForm.due_date || deadlineForm.date || ""}
                    onChange={(e) => setDeadlineForm({ ...deadlineForm, due_date: e.target.value, date: e.target.value })}
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#585866] mb-1">Typ</label>
                  <select
                    value={deadlineForm.type || "deadline"}
                    onChange={(e) => setDeadlineForm({ ...deadlineForm, type: e.target.value })}
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="deadline">Frist</option>
                    <option value="hearing">Verhandlung</option>
                    <option value="meeting">Besprechung</option>
                    <option value="filing">Schriftstück</option>
                    <option value="reminder">Erinnerung</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#585866] mb-1">Status</label>
                  <select
                    value={deadlineForm.status || "pending"}
                    onChange={(e) => setDeadlineForm({ ...deadlineForm, status: e.target.value })}
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="pending">Ausstehend</option>
                    <option value="warning">Bald fällig</option>
                    <option value="critical">Kritisch</option>
                    <option value="overdue">Überfällig</option>
                    <option value="done">Erledigt</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#585866] mb-1">Beschreibung</label>
                  <textarea
                  value={deadlineForm.description || ""}
                  onChange={(e) => setDeadlineForm({ ...deadlineForm, description: e.target.value })}
                  rows={2}
                  placeholder="Beschreibung…"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50 resize-y"
                />
              </div>
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-violet-600">Frist aus Regel berechnen</p>
                    <p className="text-[11px] text-[#585866]">Erzeugt eine prüfbare Frist mit Rechtsgrundlage und Audit-Eintrag.</p>
                  </div>
                  <Badge variant="default" className="text-[10px] bg-violet-500/10 border-violet-500/20 text-violet-600">
                    Review erforderlich
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={deadlineRuleKey}
                    onChange={(e) => setDeadlineRuleKey(e.target.value)}
                    className="bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-xs text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  >
                    {DEADLINE_RULES.map((rule) => (
                      <option key={rule.key} value={rule.key}>{rule.label} ({rule.law})</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={deadlineStartDate}
                    onChange={(e) => setDeadlineStartDate(e.target.value)}
                    className="bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-xs text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  />
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => {
                      const rule = DEADLINE_RULES.find((r) => r.key === deadlineRuleKey) ?? DEADLINE_RULES[0];
                      setDeadlineForm(calculateDeadline(rule, deadlineStartDate));
                    }}
                  >
                    Berechnen
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
	                  onClick={() => {
	                    if (!deadlineForm.title?.trim() || !(deadlineForm.due_date || deadlineForm.date)) return;
                      const date = (deadlineForm.due_date || deadlineForm.date)!;
	                    const entry: DeadlineEntry = {
	                      ...withDeadlineAudit(deadlineForm, editingDeadlineIndex !== null ? "updated" : "created"),
	                      id: deadlineForm.id || `dl-${Date.now()}`,
                        due_date: date,
                        date,
                        status: computeDeadlineStatus(date, deadlineForm.status),
                        review_status: deadlineForm.review_status ?? "unreviewed",
	                    };
                    let updated: DeadlineEntry[];
                    if (editingDeadlineIndex !== null) {
                      updated = deadlinesList.map((dl, i) => i === editingDeadlineIndex ? entry : dl);
                      setEditingDeadlineIndex(null);
                    } else {
                      updated = [...deadlinesList, entry];
                    }
                    setDeadlinesList(updated);
                    setDeadlineForm({});
                    saveCaseUpdate({ deadlines: updated });
                  }}
                >
                  <Plus size={14} />
                  {editingDeadlineIndex !== null ? "Speichern" : "Hinzufügen"}
                </Button>
                {editingDeadlineIndex !== null && (
                  <Button
                    variant="ghost"
                    className="text-[#585866] hover:text-[#15151d] text-sm"
                    onClick={() => { setEditingDeadlineIndex(null); setDeadlineForm({}); }}
                  >
                    Abbrechen
                  </Button>
                )}
              </div>
            </div>

            {/* AI Deadline Detection */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">KI-Fristen-Erkennung</span>
                </div>
                <Badge variant="default" className="text-[10px] bg-blue-500/10 border-blue-500/20 text-blue-600">Beta</Badge>
              </div>
              <p className="text-xs text-[#585866]">
                Fügen Sie E-Mail-Text oder ein Schriftstück ein — die KI erkennt automatisch Fristen und Termine.
              </p>
              <textarea
                value={aiDetectText}
                onChange={(e) => setAiDetectText(e.target.value)}
                rows={3}
                placeholder="Z. B.: 'Binnen 4 Wochen ab Zustellung des Urteils vom 15.06.2026 können Berufung eingelegt werden…'"
                className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-blue-500/50 resize-y"
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="primary"
                  className="bg-blue-600 hover:bg-blue-500 text-white gap-2 text-sm"
                  onClick={async () => {
                    if (!aiDetectText.trim()) return;
                    setAiDetecting(true);
                    try {
                      const res = await fetch("/api/legal/ai-deadlines", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: aiDetectText, caseSlug: slug }),
                      });
                      const data = await res.json();
                      if (data.detected?.length > 0) {
                        setAiDetectedDeadlines(data.detected);
                      } else {
                        setAiDetectedDeadlines([]);
                      }
                    } catch {
                      setAiDetectedDeadlines([]);
                    } finally {
                      setAiDetecting(false);
                    }
                  }}
                  disabled={aiDetecting || !aiDetectText.trim()}
                >
                  {aiDetecting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {aiDetecting ? "Analysiere…" : "Fristen erkennen"}
                </Button>
                {aiDetectedDeadlines.length > 0 && (
                  <Button
                    variant="ghost"
                    className="text-[#585866] hover:text-[#15151d] text-sm"
                    onClick={() => { setAiDetectedDeadlines([]); setAiDetectText(""); }}
                  >
                    Zurücksetzen
                  </Button>
                )}
              </div>
              {aiDetectedDeadlines.length > 0 && (
                <div className="space-y-2">
                  {aiDetectedDeadlines.map((d, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-[#e2e4ec] bg-[#ffffff] px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm text-[#15151d]">{d.title}</div>
                        <div className="text-xs text-[#585866]">{d.date} · {d.type}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="default" className="text-[10px] bg-emerald-500/10 border-emerald-500/20 text-emerald-600">
                          {Math.round(d.confidence * 100)}%
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => {
                            const entry: DeadlineEntry = {
                              id: `dl-${Date.now()}`,
                              title: d.title,
                              date: d.date,
                              due_date: d.date,
                              type: d.type as DeadlineEntry["type"],
                              status: "pending",
                              review_status: "unreviewed",
                            };
                            const updated = [...deadlinesList, entry];
                            setDeadlinesList(updated);
                            saveCaseUpdate({ deadlines: updated });
                            setAiDetectedDeadlines((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                        >
                          <Plus size={12} /> Hinzufügen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deadlines List */}
            {deadlinesList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <CalendarClock size={40} className="mx-auto text-[#e2e4ec]" />
                <p className="text-[#585866] text-sm">Noch keine Fristen für diese Akte.</p>
                <p className="text-[#585866] text-xs">Fügen Sie oben Fristen und Termine hinzu.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deadlinesList.map((dl, i) => {
                  const dlDate = new Date(dl.due_date || dl.date || Date.now());
                  const today = new Date(); today.setHours(0,0,0,0);
                  const daysUntil = Math.ceil((dlDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysUntil < 0;
                  const isCritical = daysUntil >= 0 && daysUntil <= 3;
                  const isWarning = daysUntil > 3 && daysUntil <= 7;
	                  const status = dl.status === "done" ? "done" :
	                    isOverdue ? "overdue" :
	                    isCritical ? "critical" :
	                    isWarning ? "warning" : "pending";
                  const statusConfig: Record<string, { label: string; color: string; border: string }> = {
                    pending: { label: "Ausstehend", color: "text-blue-600", border: "border-blue-500/20 bg-blue-500/5" },
                    warning: { label: "Bald fällig", color: "text-amber-600", border: "border-amber-500/20 bg-amber-500/5" },
                    critical: { label: "Kritisch", color: "text-red-600", border: "border-red-500/20 bg-red-500/5" },
                    overdue: { label: "Überfällig", color: "text-rose-600", border: "border-rose-500/20 bg-rose-500/5" },
                    done: { label: "Erledigt", color: "text-emerald-600", border: "border-emerald-500/20 bg-emerald-500/5" },
                  };
                  const cfg = statusConfig[status];
                  return (
                    <div key={i} className={cn("rounded-xl border p-4", cfg.border)}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#15151d]">{dl.title}</span>
	                          <Badge variant="default" className={cn("text-[10px] border", statusBadgeClasses(status as StatusColor))}>
	                            {cfg.label}
	                          </Badge>
                            <Badge
                              variant="default"
                              className={cn(
                                "text-[10px] border",
                                dl.review_status === "approved"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                                  : dl.review_status === "rejected"
                                  ? "bg-red-500/10 border-red-500/20 text-red-600"
                                  : dl.review_status === "reviewed"
                                  ? "bg-blue-500/10 border-blue-500/20 text-blue-600"
                                  : "bg-amber-500/10 border-amber-500/20 text-amber-600"
                              )}
                            >
                              {dl.review_status === "approved" ? "Freigegeben" : dl.review_status === "rejected" ? "Abgelehnt" : dl.review_status === "reviewed" ? "Geprüft" : "Ungeprüft"}
                            </Badge>
	                        </div>
	                        <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const updated = deadlinesList.map((item, idx) => idx === i
                                  ? withDeadlineAudit({
                                      ...item,
                                      review_status: item.review_status === "approved" ? "reviewed" : "approved",
                                      reviewed_at: new Date().toISOString(),
                                      reviewed_by: caseData.ownLawyerName || "Kanzlei",
                                    }, "reviewed", item.review_status === "approved" ? "Freigabe zurückgenommen" : "Frist freigegeben")
                                  : item);
                                setDeadlinesList(updated);
                                saveCaseUpdate({ deadlines: updated });
                              }}
                              className="text-[#585866] hover:text-emerald-600 transition-colors px-2 py-1 text-xs"
                            >
                              {dl.review_status === "approved" ? "Prüfung offen" : "Freigeben"}
                            </button>
	                          <button
	                            onClick={() => { setEditingDeadlineIndex(i); setDeadlineForm(dl); }}
                            className="text-[#585866] hover:text-violet-600 transition-colors px-2 py-1 text-xs"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => {
                              const updated = deadlinesList.filter((_, idx) => idx !== i);
                              setDeadlinesList(updated);
                              saveCaseUpdate({ deadlines: updated });
                            }}
                            className="text-[#585866] hover:text-red-600 transition-colors px-2 py-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#585866]">
                        <span>{dlDate.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</span>
                        {!isOverdue && status !== "done" && <span className={cfg.color}>({daysUntil} Tage)</span>}
                        {isOverdue && <span className="text-rose-600">({Math.abs(daysUntil)} Tage überfällig)</span>}
	                        {dl.type && <Badge variant="default" className="text-[10px] bg-[#eceef3] border-[#e2e4ec] text-[#585866]">{dl.type === "deadline" ? "Frist" : dl.type === "hearing" ? "Verhandlung" : dl.type === "meeting" ? "Besprechung" : dl.type === "filing" ? "Schriftstück" : "Erinnerung"}</Badge>}
                          {dl.law && <Badge variant="default" className="text-[10px] bg-[#eceef3] border-[#e2e4ec] text-[#585866]">{dl.law}</Badge>}
	                      </div>
	                      {dl.description && <p className="text-xs text-[#585866] mt-1">{dl.description}</p>}
                        {dl.calculation_note && <p className="text-[11px] text-[#585866] mt-1">Berechnung: {dl.calculation_note}</p>}
                        {dl.reviewed_at && <p className="text-[11px] text-[#585866] mt-1">Geprüft von {dl.reviewed_by || "Kanzlei"} am {new Date(dl.reviewed_at).toLocaleString("de-DE")}</p>}
                        <div className="mt-3 pt-3 border-t border-[#e2e4ec]/50">
                          <CommentThread
                            parentSlug={`${slug}/deadline/${i}`}
                            parentType="deadline"
                            currentUserId={currentUserId}
                            currentUserName={currentUserName}
                          />
                        </div>
	                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTask.trim()) {
                      const updated = [...tasks, { id: Date.now().toString(), text: newTask.trim(), done: false, createdAt: new Date().toISOString() }];
                      setTasks(updated);
                      setNewTask("");
                      saveCaseUpdate({ tasks: updated });
                    }
                  }}
                  placeholder="Neue Aufgabe…"
                  aria-label="Neue Aufgabe"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <Button
                variant="primary"
                className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
                onClick={() => {
                  if (newTask.trim()) {
                    const updated = [...tasks, { id: Date.now().toString(), text: newTask.trim(), done: false, createdAt: new Date().toISOString() }];
                    setTasks(updated);
                    setNewTask("");
                    saveCaseUpdate({ tasks: updated });
                  }
                }}
              >
                <Plus size={14} />
                Hinzufügen
              </Button>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <ListChecks size={32} className="mx-auto text-[#e2e4ec]" />
                <p className="text-[#585866] text-sm">Noch keine Aufgaben für diese Akte.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                      task.done
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-[#e2e4ec] bg-[#ffffff]"
                    )}
                  >
                    <button
                      onClick={() => {
                        const updated = tasks.map((t) => t.id === task.id ? { ...t, done: !t.done } : t);
                        setTasks(updated);
                        saveCaseUpdate({ tasks: updated });
                      }}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0",
                        task.done
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600"
                          : "border-[#e2e4ec] hover:border-violet-500/30"
                      )}
                    >
                      {task.done && <Check size={12} />}
                    </button>
                    <span className={cn("text-sm flex-1", task.done ? "text-[#585866] line-through" : "text-[#15151d]")}>
                      {task.text}
                    </span>
                    <button
                      onClick={() => {
                        const updated = tasks.filter((t) => t.id !== task.id);
                        setTasks(updated);
                        saveCaseUpdate({ tasks: updated });
                      }}
                      className="text-[#585866] hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "graph" && (
          <div className="max-w-3xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Case entity (center) */}
              <div className="md:col-span-2 rounded-xl border border-violet-500/20 bg-violet-600/5 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-600/15 flex items-center justify-center">
                  <Briefcase size={20} className="text-violet-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-violet-600">{caseData.title}</div>
                  <div className="text-xs text-[#585866]">{caseData.caseNumber} · {caseData.legalArea}</div>
                </div>
              </div>

              {/* Client */}
              {caseData.clientName && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600/15 flex items-center justify-center">
                    <Users size={20} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#585866]">Mandant</div>
                    <div className="text-sm font-medium text-[#15151d] truncate">{caseData.clientName}</div>
                  </div>
                </div>
              )}

              {/* Opponent */}
              {caseData.opponentName && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-600/15 flex items-center justify-center">
                    <ShieldAlert size={20} className="text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#585866]">Gegner</div>
                    <div className="text-sm font-medium text-[#15151d] truncate">{caseData.opponentName}</div>
                  </div>
                </div>
              )}

              {/* Court */}
              {caseData.courtName && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/15 flex items-center justify-center">
                    <Landmark size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#585866]">Gericht</div>
                    <div className="text-sm font-medium text-[#15151d] truncate">{caseData.courtName}</div>
                  </div>
                </div>
              )}

              {/* Lawyer */}
              {caseData.ownLawyerName && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-600/15 flex items-center justify-center">
                    <User size={20} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#585866]">Anwalt</div>
                    <div className="text-sm font-medium text-[#15151d] truncate">{caseData.ownLawyerName}</div>
                  </div>
                </div>
              )}

              {/* Claims count */}
              {caseData.claims.length > 0 && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-600/15 flex items-center justify-center">
                    <Scale size={20} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#585866]">Ansprüche</div>
                    <div className="text-sm font-medium text-[#15151d]">{caseData.claims.length} Klageanträge</div>
                  </div>
                </div>
              )}

              {/* Evidence count */}
              {evidenceList.length > 0 && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-600/15 flex items-center justify-center">
                    <ShieldAlert size={20} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#585866]">Beweismittel</div>
                    <div className="text-sm font-medium text-[#15151d]">{evidenceList.length} Mittel</div>
                  </div>
                </div>
              )}

              {/* Documents count */}
              {caseData.documents.length > 0 && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-600/15 flex items-center justify-center">
                    <FileText size={20} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#585866]">Dokumente</div>
                    <div className="text-sm font-medium text-[#15151d]">{caseData.documents.length} Dateien</div>
                  </div>
                </div>
              )}

              {/* Deadlines count */}
              {deadlinesList.length > 0 && (
                <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-pink-600/15 flex items-center justify-center">
                    <CalendarClock size={20} className="text-pink-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#585866]">Fristen</div>
                    <div className="text-sm font-medium text-[#15151d]">{deadlinesList.length} Termine</div>
                  </div>
                </div>
              )}
            </div>

            {/* Linked pages / Norms from citations */}
            {caseData.facts && (
              <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
                <h3 className="text-sm font-semibold text-[#15151d] mb-3">Zitierte Normen</h3>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const citations = parseCitations(caseData.facts).filter((s) => s.isCitation).map((s) => s.text);
                    if (citations.length === 0) return <p className="text-xs text-[#585866]">Keine Normen im Sachverhalt zitiert.</p>;
                    return citations.map((c, i) => (
                      <Link key={i} href={`/dashboard/norms?citation=${encodeURIComponent(c)}`} className="text-xs bg-violet-600/10 text-violet-600 border border-violet-500/20 rounded-lg px-2.5 py-1 hover:bg-violet-600/20 transition-colors">
                        {c}
                      </Link>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "evidence" && (
          <div className="max-w-3xl space-y-4">
            {/* Add/Edit Form */}
            <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#15151d]">
                {editingEvidenceIndex !== null ? "Beweismittel bearbeiten" : "Beweismittel hinzufügen"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#585866] mb-1">Titel</label>
                  <input
                    value={evidenceForm.title || ""}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })}
                    placeholder="z.B. Vertrag vom 01.03.2026"
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#585866] mb-1">Typ</label>
                  <select
                    value={evidenceForm.type || ""}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, type: e.target.value })}
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="">Typ wählen…</option>
                    <option value="Dokument">Dokument</option>
                    <option value="Zeugnis">Zeugnis</option>
                    <option value="Sachverständigengutachten">Sachverständigengutachten</option>
                    <option value="Vertrag">Vertrag</option>
                    <option value="Fotos/Videos">Fotos/Videos</option>
                    <option value="E-Mail/Schriftverkehr">E-Mail/Schriftverkehr</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#585866] mb-1">Beschreibung</label>
                <textarea
                  value={evidenceForm.description || ""}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })}
                  rows={2}
                  placeholder="Beschreibung des Beweismittels…"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50 resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#585866] mb-1">Quelle</label>
                  <input
                    value={evidenceForm.source || ""}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, source: e.target.value })}
                    placeholder="z.B. Akte 2026-001"
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#585866] mb-1">Beweisstärke ({Math.round((evidenceForm.weight || 0.5) * 100)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={evidenceForm.weight || 0.5}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, weight: parseFloat(e.target.value) })}
                    className="w-full accent-violet-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
                  onClick={() => {
                    if (!evidenceForm.title?.trim()) return;
                    let updated: EvidenceEntry[];
                    if (editingEvidenceIndex !== null) {
                      updated = evidenceList.map((ev, i) => i === editingEvidenceIndex ? evidenceForm : ev);
                      setEditingEvidenceIndex(null);
                    } else {
                      updated = [...evidenceList, evidenceForm];
                    }
                    setEvidenceList(updated);
                    setEvidenceForm({});
                    saveCaseUpdate({ evidence: updated });
                  }}
                >
                  <Plus size={14} />
                  {editingEvidenceIndex !== null ? "Speichern" : "Hinzufügen"}
                </Button>
                {editingEvidenceIndex !== null && (
                  <Button
                    variant="ghost"
                    className="text-[#585866] hover:text-[#15151d] text-sm"
                    onClick={() => { setEditingEvidenceIndex(null); setEvidenceForm({}); }}
                  >
                    Abbrechen
                  </Button>
                )}
              </div>
            </div>

            {/* Evidence List */}
            {evidenceList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <ShieldAlert size={40} className="mx-auto text-[#e2e4ec]" />
                <p className="text-[#585866] text-sm">Noch keine Beweismittel erfasst.</p>
                <p className="text-[#585866] text-xs">Fügen Sie oben Beweismittel hinzu, um die Beweislage zu dokumentieren.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {evidenceList.map((ev, i) => (
                  <div key={i} className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {ev.type && (
                          <Badge variant="default" className="text-[10px] bg-violet-600/5 border-violet-500/10 text-violet-600">
                            {ev.type}
                          </Badge>
                        )}
                        <span className="text-sm font-medium text-[#15151d]">{ev.title || "Beweismittel"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingEvidenceIndex(i); setEvidenceForm(ev); }}
                          className="text-[#585866] hover:text-violet-600 transition-colors px-2 py-1 text-xs"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => {
                            const updated = evidenceList.filter((_, idx) => idx !== i);
                            setEvidenceList(updated);
                            saveCaseUpdate({ evidence: updated });
                          }}
                          className="text-[#585866] hover:text-red-600 transition-colors px-2 py-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {ev.description && <p className="text-sm text-[#585866] mb-2">{ev.description}</p>}
                    <div className="flex items-center gap-3">
                      {ev.source && <span className="text-xs text-[#585866]">Quelle: {ev.source}</span>}
                      <div className="flex-1">
                        <div className="h-1.5 rounded-full bg-[#e2e4ec] overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              (ev.weight || 0) >= 0.7 ? "bg-emerald-500" :
                              (ev.weight || 0) >= 0.4 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${Math.round((ev.weight || 0) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-[#585866] mt-0.5 text-right">
                          Beweisstärke: {Math.round((ev.weight || 0) * 100)}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#e2e4ec]">
                      <CommentThread
                        parentSlug={`${slug}/evidence/${i}`}
                        parentType="evidence"
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "time" && (
          <div className="max-w-3xl space-y-4">
            <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#15151d]">Zeiterfassung</h3>

              {/* Live Timer */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  "text-2xl font-mono font-bold tracking-tight",
                  timerRunning ? "text-emerald-600" : "text-[#585866]"
                )}>
                  {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}
                </div>
                {!timerRunning ? (
                  <button
                    onClick={() => {
                      setTimerRunning(true);
                      setTimerStartAt(Date.now());
                      setElapsedSeconds(0);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/15 text-emerald-600 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-600/25 transition-all"
                  >
                    <Play size={14} /> Start
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const durationMs = Date.now() - (timerStartAt ?? Date.now());
                      const minutes = Math.max(1, Math.round(durationMs / 60000));
                      setTimerRunning(false);
                      setTimerStartAt(null);
                      setElapsedSeconds(0);
                      setTimerMinutes(String(minutes));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/15 text-red-600 border border-red-500/30 text-xs font-medium hover:bg-red-600/25 transition-all"
                  >
                    <Square size={14} /> Stop
                  </button>
                )}
                {elapsedSeconds > 0 && !timerRunning && (
                  <span className="text-xs text-[#585866]">→ {timerMinutes} Min. übernommen</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_110px] gap-3">
                <input
                  value={timerDescription}
                  onChange={(e) => setTimerDescription(e.target.value)}
                  placeholder="Tätigkeit…"
                  aria-label="Tätigkeit"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                />
                <input
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(e.target.value)}
                  type="number"
                  placeholder="Min."
                  aria-label="Minuten"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                />
                <input
                  value={timerRate}
                  onChange={(e) => setTimerRate(e.target.value)}
                  type="number"
                  placeholder="€/h"
                  aria-label="Stundensatz"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_auto_auto] gap-3 items-center">
                <select
                  value={timerActivity}
                  onChange={(e) => setTimerActivity(e.target.value)}
                  className="bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50"
                >
                  <option>Beratung</option>
                  <option>Telefonat</option>
                  <option>E-Mail</option>
                  <option>Schriftsatz</option>
                  <option>Gerichtstermin</option>
                  <option>Recherche</option>
                  <option>Aktenstudium</option>
                </select>
                <input
                  value={timerLawyer}
                  onChange={(e) => setTimerLawyer(e.target.value)}
                  placeholder="Bearbeiter / Anwalt"
                  aria-label="Bearbeiter oder Anwalt"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                />
                <label className="flex items-center gap-2 text-sm text-[#585866] whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={timerBillable}
                    onChange={(e) => setTimerBillable(e.target.checked)}
                    className="accent-violet-500"
                  />
                  abrechenbar
                </label>
                <Button
                  variant="primary"
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
                  onClick={() => {
                    const mins = parseInt(timerMinutes, 10);
                    const rate = parseFloat(timerRate);
                    if (timerDescription.trim() && Number.isFinite(mins) && mins > 0) {
                      const updated: TimeEntry[] = [...timeEntries, {
                        id: Date.now().toString(),
                        description: timerDescription.trim(),
                        minutes: mins,
                        date: new Date().toISOString(),
                        rate: Number.isFinite(rate) && rate > 0 ? rate : undefined,
                        billable: timerBillable,
                        billed: false,
                        lawyer: timerLawyer.trim() || undefined,
                        activity_type: timerActivity,
                      }];
                      setTimeEntries(updated);
                      setTimerDescription("");
                      setTimerMinutes("");
                      saveCaseUpdate({ timeEntries: updated });
                    }
                  }}
                >
                  <Plus size={14} />
                  Buchen
                </Button>
              </div>
            </div>

            {timeEntries.length > 0 && (
              <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[#15151d]">Buchungen</h3>
                  <span className="text-xs text-[#585866]">
                    Gesamt: {Math.floor(timeEntries.reduce((s, e) => s + e.minutes, 0) / 60)}h {timeEntries.reduce((s, e) => s + e.minutes, 0) % 60}min
                  </span>
                </div>
                {timeEntries.map((entry) => (
                  <div key={entry.id} className="py-2 border-b border-[#e2e4ec] last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-[#15151d]">{entry.description}</span>
                          {entry.activity_type && <Badge variant="default" className="text-[10px] border border-violet-500/20 bg-violet-500/10 text-violet-700">{entry.activity_type}</Badge>}
                          {entry.billed && <Badge variant="success" className="text-[10px]">abgerechnet</Badge>}
                          {entry.billable === false && <Badge variant="warning" className="text-[10px]">intern</Badge>}
                        </div>
                        <span className="text-xs text-[#585866]">
                          {new Date(entry.date).toLocaleDateString("de-DE")}
                          {entry.lawyer ? ` · ${entry.lawyer}` : ""}
                          {entry.rate ? ` · ${entry.rate.toFixed(2)} €/h` : ""}
                          {entry.invoice_number ? ` · ${entry.invoice_number}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm text-[#585866] font-mono">{entry.minutes} min</span>
                        {!entry.billed && (
                          <button
                            onClick={() => {
                              const updated = timeEntries.filter((e) => e.id !== entry.id);
                              setTimeEntries(updated);
                              saveCaseUpdate({ timeEntries: updated });
                            }}
                            className="p-1.5 rounded-lg text-[#585866] hover:text-red-600 hover:bg-red-500/10 transition-all"
                            title="Buchung löschen"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <CommentThread
                        parentSlug={`${slug}/time/${entry.id}`}
                        parentType="time_entry"
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "expenses" && (
          <div className="max-w-3xl space-y-4">
            <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#15151d]">Auslagen</h3>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_130px_auto_auto] gap-3 items-center">
                <input
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="z. B. Gerichtskosten, Porto, Fahrtkosten"
                  aria-label="Auslage"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                />
                <input
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  type="number"
                  step="0.01"
                  placeholder="Betrag €"
                  aria-label="Betrag"
                  className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50"
                />
                <label className="flex items-center gap-2 text-sm text-[#585866] whitespace-nowrap">
                  <input type="checkbox" checked={expenseBillable} onChange={(e) => setExpenseBillable(e.target.checked)} className="accent-violet-500" />
                  abrechenbar
                </label>
                <Button
                  variant="primary"
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-sm"
                  onClick={() => {
                    const amount = parseFloat(expenseAmount);
                    if (expenseDescription.trim() && Number.isFinite(amount) && amount > 0) {
                      const updated: ExpenseEntry[] = [...expensesList, {
                        id: Date.now().toString(),
                        description: expenseDescription.trim(),
                        amount: Math.round(amount * 100) / 100,
                        date: new Date().toISOString(),
                        billable: expenseBillable,
                        billed: false,
                      }];
                      setExpensesList(updated);
                      setExpenseDescription("");
                      setExpenseAmount("");
                      saveCaseUpdate({ expenses: updated });
                    }
                  }}
                >
                  <Plus size={14} />
                  Erfassen
                </Button>
              </div>
            </div>

            {expensesList.length > 0 && (
              <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[#15151d]">Auslagenliste</h3>
                  <span className="text-xs text-[#585866]">
                    Gesamt: {expensesList.reduce((s, e) => s + e.amount, 0).toFixed(2)} €
                  </span>
                </div>
                {expensesList.map((entry) => (
                  <div key={entry.id} className="py-2 border-b border-[#e2e4ec] last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-[#15151d]">{entry.description}</span>
                          {entry.billed && <Badge variant="success" className="text-[10px]">abgerechnet</Badge>}
                          {entry.billable === false && <Badge variant="warning" className="text-[10px]">intern</Badge>}
                        </div>
                        <span className="text-xs text-[#585866]">
                          {new Date(entry.date).toLocaleDateString("de-DE")}
                          {entry.invoice_number ? ` · ${entry.invoice_number}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm text-[#585866] font-mono">{entry.amount.toFixed(2)} €</span>
                        {!entry.billed && (
                          <button
                            onClick={() => {
                              const updated = expensesList.filter((e) => e.id !== entry.id);
                              setExpensesList(updated);
                              saveCaseUpdate({ expenses: updated });
                            }}
                            className="p-1.5 rounded-lg text-[#585866] hover:text-red-600 hover:bg-red-500/10 transition-all"
                            title="Auslage löschen"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <CommentThread
                        parentSlug={`${slug}/expense/${entry.id}`}
                        parentType="expense"
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "audit" && (
          <div className="max-w-3xl space-y-4">
            <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#15151d]">Audit-Trail</h3>
              {caseData.auditLog && caseData.auditLog.length > 0 ? (
                <div className="space-y-2">
                  {caseData.auditLog.slice().reverse().map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[#ffffff] border border-[#e2e4ec]">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-[#15151d]">{entry.note}</span>
                          <Badge variant="default" className="text-[10px] bg-[#eceef3] border border-[#e2e4ec] text-[#585866]">
                            {entry.field}
                          </Badge>
                        </div>
                        <div className="text-xs text-[#585866] mt-0.5">
                          {entry.actor} · {new Date(entry.at).toLocaleString("de-DE")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-[#585866]">
                  Noch keine Audit-Einträge vorhanden.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "query" && (
          <div className="max-w-3xl space-y-4">
            <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-4">
              <p className="text-sm text-[#585866] mb-3">
                Stelle eine Frage im Kontext dieser Akte. Das Brain durchsucht alle zugehörigen Dokumente und Gesetze.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MessageSquare size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#585866]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                    placeholder="Frage zur Akte…"
                    aria-label="Frage zur Akte"
                    className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
                <Button
                  onClick={handleQuery}
                  disabled={queryLoading || !query.trim()}
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
                >
                  {queryLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Senden
                </Button>
              </div>
            </div>

            {queryResult && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-violet-600 font-medium">KI-Antwort</span>
                  <button
                    onClick={() => copyToClipboard(queryResult)}
                    className="text-[#585866] hover:text-[#585866] transition-colors"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="text-sm text-[#15151d] whitespace-pre-wrap leading-relaxed">
                  {queryResult}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
