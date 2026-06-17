"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Download,
  CalendarClock,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { STATUS_BG, statusBadgeClasses, type StatusColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { caseFrontmatter } from "@/lib/legal-types";
import { timelineToDeadline } from "@/lib/legal-deadlines";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
  type: "deadline" | "hearing" | "meeting" | "reminder";
  caseNumber?: string;
  location?: string;
}

function generateIcal(events: CalendarEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SigmaBrain//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:SigmaBrain Kanzlei-Fristen",
    "X-WR-TIMEZONE:Europe/Berlin",
  ];

  for (const ev of events) {
    const uid = `${ev.id}@sigmabrain.local`;
    const dateStr = ev.date.replace(/-/g, "");
    const dtStart = `${dateStr}T090000Z`;
    const dtEnd = `${dateStr}T100000Z`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcalText(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcalText(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcalText(ev.location)}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcalText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export default function CalendarExportPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "deadline" | "hearing" | "meeting">("all");

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const pages = await api.brain.listPages({ type: "legal_deadline" });
      const loaded: CalendarEvent[] = pages.map((p) => {
        const fm = (p.frontmatter ?? {}) as Record<string, unknown>;
        return {
          id: String(p.slug || ""),
          title: String(p.title || ""),
          date: String(fm.due_date || fm.date || p.created_at?.split("T")[0] || new Date().toISOString().split("T")[0]),
          description: String(fm.description || p.content?.slice(0, 200) || ""),
          type: String(fm.event_type || "deadline") as CalendarEvent["type"],
          caseNumber: fm.case_number ? String(fm.case_number) : undefined,
          location: fm.court ? String(fm.court) : fm.location ? String(fm.location) : undefined,
        };
      });

      // Also try to load from legal-case pages that have deadline data
      const casePages = await api.brain.listPages({ type: "legal_case" });
      for (const cp of casePages) {
        const fm = caseFrontmatter(cp);
        const rawDeadlines = fm.deadlines?.length
          ? fm.deadlines
          : [...(fm.timeline ?? []), ...(fm.timeline_events ?? [])].map((entry) => timelineToDeadline(entry, cp.slug));
        if (rawDeadlines.length) {
          for (const dl of rawDeadlines) {
            const date = dl.due_date || dl.date;
            if (!date) continue;
            loaded.push({
              id: `deadline-${String(cp.slug)}-${String(dl.title || "")}`,
              title: String(dl.title || ""),
              date: String(date),
              description: String(dl.description || `Frist für Akte ${fm.case_number || cp.slug}`),
              type: String(dl.type || "deadline") as CalendarEvent["type"],
              caseNumber: fm.case_number ? String(fm.case_number) : undefined,
              location: dl.court ? String(dl.court) : dl.location ? String(dl.location) : undefined,
            });
          }
        }
      }

      setEvents(loaded.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Termine konnten nicht geladen werden.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  function downloadIcal() {
    const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);
    const ical = generateIcal(filtered);
    const blob = new Blob([ical], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sigmabrain-fristen-${new Date().toISOString().split("T")[0]}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);
  const upcoming = filtered.filter((e) => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)));
  const overdue = filtered.filter((e) => new Date(e.date) < new Date(new Date().setHours(0, 0, 0, 0)));

  const TYPE_COLORS: Record<string, StatusColor> = {
    deadline: "amber",
    hearing: "blue",
    meeting: "violet",
    reminder: "emerald",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
            <Calendar size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#15151d]">Kalender-Export</h1>
            <p className="text-sm text-[#585866]">Fristen & Termine als iCal (.ics)</p>
          </div>
        </div>
        <Button
          variant="primary"
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2 text-sm"
          onClick={downloadIcal}
        >
          <Download size={14} />
          iCal herunterladen
        </Button>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <CalendarClock size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-600">
          <p className="font-medium mb-1">Importieren Sie die .ics-Datei in:</p>
          <ul className="space-y-0.5 text-xs">
            <li>• Outlook: Datei → Öffnen und Exportieren → Importieren/Exportieren → iCalendar</li>
            <li>• Google Calendar: Einstellungen → Kalender importieren → Datei auswählen</li>
            <li>• Apple Calendar: Datei → Importieren → .ics auswählen</li>
          </ul>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "deadline", "hearing", "meeting"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === f
                ? "bg-blue-600/15 text-blue-600 border-blue-500/30"
                : "bg-[#ffffff] border-[#e2e4ec] text-[#585866] hover:text-[#15151d]"
            }`}
          >
            {f === "all" ? "Alle" : f === "deadline" ? "Fristen" : f === "hearing" ? "Verhandlungen" : "Besprechungen"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3 text-center">
          <div className="text-xs text-[#585866]">Anstehend</div>
          <div className="text-xl font-bold text-blue-600">{upcoming.length}</div>
        </div>
        <div className="rounded-xl border border-[#e2e4ec] bg-[#ffffff] p-3 text-center">
          <div className="text-xs text-[#585866]">Überfällig</div>
          <div className="text-xl font-bold text-red-600">{overdue.length}</div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Events */}
      {loading ? (
        <div className="text-center py-20 text-[#585866]">Lade Termine…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <CalendarClock size={48} className="mx-auto text-[#e2e4ec]" />
          <p className="text-[#585866]">Keine Termine gefunden.</p>
          <p className="text-[#585866] text-sm">Erstellen Sie Fristen in Akten oder nutzen Sie den Deadline-Extractor.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ev) => {
            const color = TYPE_COLORS[ev.type] || "gray";
            const isOverdue = new Date(ev.date) < new Date(new Date().setHours(0, 0, 0, 0));
            return (
              <div
                key={ev.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isOverdue
                    ? "border-red-500/20 bg-red-500/5"
                    : "border-[#e2e4ec] bg-[#ffffff]"
                }`}
              >
                <div className={cn("w-2 h-2 rounded-full shrink-0", STATUS_BG[color])} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#15151d]">{ev.title}</span>
                    <Badge variant="default" className={cn("text-[10px] border", statusBadgeClasses(color))}>
                      {ev.type === "deadline" ? "Frist" : ev.type === "hearing" ? "Verhandlung" : ev.type === "meeting" ? "Besprechung" : "Erinnerung"}
                    </Badge>
                    {isOverdue && (
                      <Badge variant="default" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
                        Überfällig
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-[#585866] mt-0.5">
                    {new Date(ev.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                    {ev.caseNumber && ` · Akte ${ev.caseNumber}`}
                    {ev.location && ` · ${ev.location}`}
                  </div>
                  {ev.description && (
                    <div className="text-xs text-[#585866] mt-1 line-clamp-1">{ev.description}</div>
                  )}
                </div>
                <div className="shrink-0 text-xs text-[#585866]">
                  {isOverdue ? <AlertTriangle size={14} className="text-red-600" /> : <Clock size={14} className="text-blue-600" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
