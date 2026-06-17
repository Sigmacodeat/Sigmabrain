"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  FileText,
  Calculator,
  ChevronDown,
  Mail,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { STATUS_TEXT, STATUS_BG, STATUS_BORDER, type StatusColor } from "@/lib/status-colors";
import { caseFrontmatter } from "@/lib/legal-types";
import { OFFLINE_KEYS, getCache, setCache } from "@/lib/offline-store";
import {
  DEADLINE_RULES,
  computeDeadlineStatus,
  computeDueDate,
  timelineToDeadline,
  type DeadlineRule,
} from "@/lib/legal-deadlines";

interface DeadlineItem {
  id: string;
  date: string;
  description: string;
  caseSlug?: string;
  caseTitle?: string;
  source?: string;
  status: "pending" | "warning" | "critical" | "overdue" | "done";
  type: "deadline" | "event" | "hearing" | "filing";
  reviewStatus?: string;
  law?: string;
  reminderSentAt?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: StatusColor; icon: React.ElementType }> = {
  pending: { label: "Ausstehend", color: "blue", icon: Clock },
  warning: { label: "Bald fällig", color: "amber", icon: AlertTriangle },
  critical: { label: "Kritisch", color: "red", icon: AlertTriangle },
  overdue: { label: "Überfällig", color: "rose", icon: XCircle },
  done: { label: "Erledigt", color: "emerald", icon: CheckCircle2 },
};

const TYPE_CONFIG: Record<string, string> = {
  deadline: "Frist",
  event: "Termin",
  hearing: "Verhandlung",
  filing: "Schriftstück",
};

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Fristregeln kommen zentral aus @/lib/legal-deadlines (korrekte Normzitate,
// Kalender- statt Werktagsfristen, Monatsarithmetik nach § 188 BGB,
// Wochenend-Verschiebung nach § 222 Abs. 2 ZPO).
function calculateDeadline(rule: DeadlineRule, startDate: string): { dueDate: Date; label: string; law: string; note: string } {
  const { dueDate, note } = computeDueDate(rule, startDate);
  return { dueDate: new Date(`${dueDate}T12:00:00Z`), label: rule.label, law: rule.law, note };
}

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [showCalc, setShowCalc] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [calcTemplate, setCalcTemplate] = useState<DeadlineRule>(DEADLINE_RULES[0]);
  const [calcDate, setCalcDate] = useState(new Date().toISOString().split("T")[0]);
  const [calcResult, setCalcResult] = useState<{ dueDate: Date; label: string; law: string; note: string } | null>(null);
  const [showAiDetect, setShowAiDetect] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiResults, setAiResults] = useState<Array<{ type: string; description: string; date?: string; confidence: string }>>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load legal-case pages and extract deadlines from frontmatter
        const pages = await api.brain.listPages({ type: "legal_case", limit: 200 });
        if (cancelled) return;
        const items: DeadlineItem[] = [];
        for (const page of pages) {
          const fm = caseFrontmatter(page);
          const rawDeadlines = fm.deadlines || [];
          for (const d of rawDeadlines) {
            const date = d.due_date || d.date;
            if (!date) continue; // Frist ohne Datum ist nicht anzeigbar
            items.push({
              id: d.id || `${page.slug}-${date}`,
              date,
              description: d.description || d.title || "",
              caseSlug: page.slug,
              caseTitle: page.title,
              source: d.source || page.slug,
              status: computeDeadlineStatus(date, d.status),
              type: (d.type as DeadlineItem["type"]) || "deadline",
              reviewStatus: d.review_status,
              law: d.law,
              reminderSentAt: d.reminder_sent_at,
            });
          }
          // Timeline entries — die Akten-Detailseite speichert unter
          // timeline_events, ältere Pipelines unter timeline; beide lesen.
          const timeline = [...(fm.timeline ?? []), ...(fm.timeline_events ?? [])];
          for (const entry of timeline) {
            if (entry.date && (entry.type === "deadline" || entry.type === "event" || entry.type === "hearing")) {
              const d = timelineToDeadline(entry, page.slug);
              items.push({
                id: d.id || `${page.slug}-${entry.date}`,
                date: entry.date,
                description: d.description || d.title || "",
                caseSlug: page.slug,
                caseTitle: page.title,
                source: page.slug,
                status: computeDeadlineStatus(entry.date, d.status),
                type: (d.type as DeadlineItem["type"]) || "event",
                reviewStatus: d.review_status,
                reminderSentAt: d.reminder_sent_at,
              });
            }
          }
        }
        // Sort by date
        items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        await setCache(OFFLINE_KEYS.deadlines, items);
        setDeadlines(items);
      } catch (err) {
        const cached = await getCache<DeadlineItem[]>(OFFLINE_KEYS.deadlines);
        if (!cancelled && cached) {
          setDeadlines(cached);
          setLoadError("Cloud-Brain gerade nicht erreichbar. Es werden zwischengespeicherte Fristen angezeigt.");
        } else if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Fristen konnten nicht geladen werden.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = deadlines.filter((d) => {
    const matchesSearch =
      search === "" ||
      d.description.toLowerCase().includes(search.toLowerCase()) ||
      (d.caseTitle || "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || d.status === filter;
    return matchesSearch && matchesFilter;
  });

  const counts = deadlines.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/15 border border-amber-500/20 flex items-center justify-center">
            <CalendarClock size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[color:var(--ds-text)]">Fristen & Termine</h1>
            <p className="text-sm text-[color:var(--ds-text-muted)]">{deadlines.length} Fristen aus allen Akten</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setReminderStatus("Sende Erinnerungen…");
              try {
                const res = await fetch("/api/cron/deadline-reminders", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  setReminderStatus(`${data.sentCount} Erinnerung(en) gesendet`);
                  setTimeout(() => setReminderStatus(null), 4000);
                } else {
                  setReminderStatus(data.error === "smtp_not_configured" ? "SMTP nicht konfiguriert." : `Fehler: ${data.error}`);
                }
              } catch (err) {
                setReminderStatus("Senden fehlgeschlagen.");
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] text-xs text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text)] hover:border-[color:var(--ds-border-strong)] transition-all"
          >
            <Mail size={14} />
            Erinnerungen senden
          </button>
          <button
            onClick={() => setShowCalc(!showCalc)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] text-xs text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text)] hover:border-[color:var(--ds-border-strong)] transition-all"
          >
            <Calculator size={14} />
            Frist berechnen
          </button>
          <button
            onClick={() => setShowAiDetect(!showAiDetect)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] text-xs text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text)] hover:border-[color:var(--ds-border-strong)] transition-all"
          >
            <Sparkles size={14} />
            Fristen erkennen
          </button>
        </div>
      </div>
      {reminderStatus && (
        <div className="text-sm text-amber-600">{reminderStatus}</div>
      )}

      {/* Deadline Calculator */}
      {showCalc && (
        <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--ds-text)]">Fristenberechnung</h2>
            <button onClick={() => setShowCalc(false)} className="text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text)]"><XCircle size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[color:var(--ds-text-muted)] mb-1">Frist-Typ</label>
              <div className="relative">
                <select
                  value={calcTemplate.key}
                  onChange={(e) => setCalcTemplate(DEADLINE_RULES.find((t) => t.key === e.target.value) || DEADLINE_RULES[0])}
                  className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50 appearance-none"
                >
                  {DEADLINE_RULES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label} ({t.law})</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--ds-text-muted)] pointer-events-none" />
              </div>
              <p className="text-[11px] text-[color:var(--ds-text-muted)] mt-1">{calcTemplate.description}</p>
            </div>
            <div>
              <label className="block text-xs text-[color:var(--ds-text-muted)] mb-1">Startdatum (Zustellung / Ereignis)</label>
              <input
                type="date"
                value={calcDate}
                onChange={(e) => setCalcDate(e.target.value)}
                className="w-full bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setCalcResult(calculateDeadline(calcTemplate, calcDate))}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                <Calculator size={14} />
                Berechnen
              </button>
            </div>
          </div>
          {calcResult && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-violet-600 font-medium">{calcResult.label} — {calcResult.law}</p>
                  <p className="text-sm text-[color:var(--ds-text)] mt-1">
                    Frist bis: <strong>{calcResult.dueDate.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
                  </p>
                  <p className="text-[11px] text-[color:var(--ds-text-muted)] mt-1">{calcResult.note}</p>
                </div>
                <span className="text-xs text-[color:var(--ds-text-muted)]">
                  {Math.ceil((calcResult.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Tage verbleibend
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Deadline Detection */}
      {showAiDetect && (
        <div className="rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-surface)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" />
              <h2 className="text-sm font-semibold text-[color:var(--ds-text)]">Fristen erkennen</h2>
            </div>
            <button onClick={() => setShowAiDetect(false)} className="text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text)]"><XCircle size={16} /></button>
          </div>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            Fügen Sie einen Text (E-Mail, Brief, Gerichtsbescheid) ein. Die KI erkennt automatisch Fristen,
            Termine und gesetzliche Deadlines und schlägt deren Anlage vor.
          </p>
          <div className="flex gap-2">
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Text hier einfügen…"
              rows={4}
              className="flex-1 bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)] rounded-lg px-3 py-2 text-sm text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:outline-none focus:border-violet-500/50 resize-none"
            />
          </div>
          <button
            onClick={async () => {
              if (!aiText.trim()) return;
              setAiLoading(true);
              try {
                const res = await fetch("/api/legal/ai-deadlines", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: aiText }),
                });
                const data = await res.json();
                if (res.ok) {
                  setAiResults(data.detected || []);
                }
              } finally {
                setAiLoading(false);
              }
            }}
            disabled={aiLoading || !aiText.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {aiLoading ? "Analysiere…" : "Fristen erkennen"}
          </button>

          {aiResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[color:var(--ds-text)]">{aiResults.length} Frist(en) erkannt</h3>
              {aiResults.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[color:var(--ds-surface)] border border-[color:var(--ds-border)]">
                  <div className={`w-2 h-2 rounded-full ${r.confidence === "high" ? "bg-emerald-400" : r.confidence === "medium" ? "bg-amber-400" : "bg-red-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[color:var(--ds-text)]">{r.description}</div>
                    {r.date && <div className="text-xs text-[color:var(--ds-text-muted)]">{new Date(r.date).toLocaleDateString("de-DE")}</div>}
                  </div>
                  <Badge variant="default" className={`text-[10px] ${r.confidence === "high" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-amber-500/20 bg-amber-500/10 text-amber-600"}`}>
                    {r.confidence}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alert banner */}
      {(counts.critical || 0) > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-600">
            {counts.critical} kritische Frist{counts.critical === 1 ? "" : "en"} in den nächsten 3 Tagen
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {["pending", "warning", "critical", "overdue", "done"].map((key) => {
          const cfg = STATUS_CONFIG[key];
          const Icon = cfg.icon;
          const count = counts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? "all" : key)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                filter === key
                  ? "bg-violet-600/10 border-violet-500/30"
                  : "bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] hover:border-[color:var(--ds-border-strong)]"
              )}
            >
              <Icon size={18} className={cn("shrink-0", STATUS_TEXT[cfg.color])} aria-hidden="true" />
              <div>
                <div className="text-lg font-bold text-[color:var(--ds-text)]">{count}</div>
                <div className="text-xs text-[color:var(--ds-text-muted)]">{cfg.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ds-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Fristen suchen…"
            aria-label="Fristen suchen"
            className="pl-9 bg-[color:var(--ds-surface)] border-[color:var(--ds-border)] text-[color:var(--ds-text)] placeholder:text-[color:var(--ds-text-muted)] focus:border-violet-500/50"
          />
        </div>
        {filter !== "all" && (
          <Badge
            variant="default"
            className="cursor-pointer bg-violet-600/10 border border-violet-500/30 text-violet-600"
            onClick={() => setFilter("all")}
          >
            {STATUS_CONFIG[filter]?.label} ×
          </Badge>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label="Wird geladen">
          <Loader2 size={24} className="text-violet-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <CalendarClock size={48} className="mx-auto text-[color:var(--ds-border)]" />
          <div>
            <p className="text-[color:var(--ds-text-muted)] text-lg">Keine Fristen gefunden</p>
            <p className="text-[color:var(--ds-text-muted)] text-sm mt-1">
              {deadlines.length === 0
                ? "Fristen werden automatisch aus hochgeladenen Dokumenten extrahiert."
                : "Passe deine Filter an."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => {
            const statusCfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const days = getDaysUntil(d.date);
            return (
              <div
                key={d.id}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl border transition-all",
                  d.status === "critical" || d.status === "overdue"
                    ? "border-red-500/20 bg-red-500/5"
                    : d.status === "warning"
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-[color:var(--ds-border)] bg-[color:var(--ds-surface)]"
                )}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border", STATUS_BG[statusCfg.color], STATUS_BORDER[statusCfg.color])} aria-hidden="true">
                  <StatusIcon size={18} className={STATUS_TEXT[statusCfg.color]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[color:var(--ds-text)]">{d.description}</span>
                    <Badge variant="default" className="text-[10px] bg-[color:var(--ds-hover)] border border-[color:var(--ds-border)] text-[color:var(--ds-text-muted)]">
                      {TYPE_CONFIG[d.type] || d.type}
                    </Badge>
                    <Badge
                      variant="default"
                      className={cn(
                        "text-[10px] border",
                        d.reviewStatus === "approved"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-600"
                      )}
                    >
                      {d.reviewStatus === "approved" ? "Freigegeben" : "Review offen"}
                    </Badge>
                    {d.law && (
                      <Badge variant="default" className="text-[10px] bg-[color:var(--ds-hover)] border border-[color:var(--ds-border)] text-[color:var(--ds-text-muted)]">
                        {d.law}
                      </Badge>
                    )}
                    {d.reminderSentAt && (
                      <Badge variant="default" className="text-[10px] bg-blue-500/10 border-blue-500/20 text-blue-600">
                        Erinnerung gesendet
                      </Badge>
                    )}
                  </div>
                  {d.caseTitle && (
                    <div className="text-xs text-[color:var(--ds-text-muted)] mt-0.5">
                      <FileText size={10} className="inline mr-1" />
                      {d.caseTitle}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("text-sm font-medium", days < 0 ? "text-red-600" : days <= 3 ? "text-amber-600" : "text-[color:var(--ds-text)]")}>
                    {new Date(d.date).toLocaleDateString("de-DE")}
                  </div>
                  <div className="text-xs text-[color:var(--ds-text-muted)]">
                    {days < 0 ? `${Math.abs(days)} Tage überfällig` : days === 0 ? "Heute" : days === 1 ? "Morgen" : `in ${days} Tagen`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
