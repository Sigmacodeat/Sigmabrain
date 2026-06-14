"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Network,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Bell,
  User,
  Users,
  Search,
  CreditCard,
  LogOut,
  Menu,
  X,
  Briefcase,
  CalendarClock,
  Scale,
  ShieldAlert,
  Landmark,
  Plug,
  PenTool,
  Swords,
  UserCircle,
  ShieldCheck,
  FileSpreadsheet,
  ScrollText,
  Bot,
  FileText,
  Mail,
  RefreshCw,
  FileSignature,
  Smartphone,
  EyeOff,
  Table2,
  Gavel,
  CloudOff,
  BarChart3,
  Archive,
  Building2,
  Shield,
  Key,
  FolderOpen,
  Sparkles,
  Globe,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMutationQueue } from "@/lib/use-mutation";
import { useBrainSelector } from "@/lib/use-brain-selector";
import { SigmaMark } from "@/components/brand/logo";
import { useNetworkStatus } from "@/lib/use-offline-sync";
import { ensureRealtime } from "@/lib/realtime";

// Gruppierte Navigation: jede Sektion mit Überschrift. Alles erreichbar,
// aber nach Arbeitsbereich sortiert statt 27 flacher Einträge.
const NAV_SECTIONS: { title: string; items: { href: string; icon: typeof LayoutDashboard; label: string }[] }[] = [
  {
    title: "Gehirn",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Übersicht" },
      { href: "/dashboard/assistant", icon: Bot, label: "Assistant" },
      { href: "/dashboard/query", icon: MessageSquare, label: "Query" },
      { href: "/dashboard/agents", icon: Sparkles, label: "Agenten" },
      { href: "/dashboard/approvals", icon: Gavel, label: "Freigaben" },
      { href: "/dashboard/brain", icon: BookOpen, label: "Brain" },
      { href: "/dashboard/graph", icon: Network, label: "Graph" },
      { href: "/dashboard/upload", icon: Upload, label: "Upload" },
      { href: "/dashboard/rag-eval", icon: BarChart3, label: "RAG-Eval" },
    ],
  },
  {
    title: "Akten & Fristen",
    items: [
      { href: "/dashboard/cases", icon: Briefcase, label: "Akten" },
      { href: "/dashboard/contacts", icon: Users, label: "Kontakte" },
      { href: "/dashboard/contracts", icon: ShieldCheck, label: "Verträge" },
      { href: "/dashboard/vault", icon: FolderOpen, label: "Dokumenten-Vault" },
      { href: "/dashboard/deadlines", icon: CalendarClock, label: "Fristen" },
      { href: "/dashboard/opponents", icon: Swords, label: "Gegner" },
      { href: "/dashboard/client-portal", icon: UserCircle, label: "Mandanten-Portal" },
    ],
  },
  {
    title: "Recherche",
    items: [
      { href: "/dashboard/research", icon: Globe, label: "Legal Research" },
      { href: "/dashboard/rechtsprechung", icon: Landmark, label: "Rechtsprechung" },
      { href: "/dashboard/norms", icon: BookOpen, label: "Normen" },
      { href: "/dashboard/judgements-sync", icon: RefreshCw, label: "Urteile-Sync" },
      { href: "/dashboard/kollisionspruefung", icon: ShieldAlert, label: "Kollisionsprüfung" },
      { href: "/dashboard/tabular-review", icon: Table2, label: "Massen-Review" },
      { href: "/dashboard/monitoring", icon: Bell, label: "Monitoring" },
    ],
  },
  {
    title: "Schriftsätze & Abrechnung",
    items: [
      { href: "/dashboard/drafting", icon: PenTool, label: "Schriftsatz" },
      { href: "/dashboard/cost-calculator", icon: Scale, label: "Kostenrechner" },
      { href: "/dashboard/invoicing", icon: FileText, label: "Rechnungen" },
      { href: "/dashboard/datev-export", icon: FileSpreadsheet, label: "DATEV-Export" },
      { href: "/dashboard/signature", icon: FileSignature, label: "e-Signatur" },
    ],
  },
  {
    title: "Daten & Integration",
    items: [
      { href: "/dashboard/connectors", icon: Plug, label: "Konnektoren" },
      { href: "/dashboard/whatsapp", icon: MessageSquare, label: "WhatsApp" },
      { href: "/dashboard/import-kanzlei", icon: FileSpreadsheet, label: "Kanzlei-Import" },
      { href: "/dashboard/bea", icon: Mail, label: "beA" },
      { href: "/dashboard/email-import", icon: Mail, label: "E-Mail-Import" },
      { href: "/dashboard/calendar-export", icon: CalendarClock, label: "Kalender" },
      { href: "/dashboard/compliance", icon: ShieldCheck, label: "Compliance" },
      { href: "/dashboard/compliance/retention", icon: CalendarClock, label: "Löschfristen" },
      { href: "/dashboard/anonymize", icon: EyeOff, label: "Anonymisierung" },
      { href: "/dashboard/verfahrensdoku", icon: ScrollText, label: "Verfahrensdoku" },
      { href: "/dashboard/data-export", icon: Archive, label: "Datenexport" },
    ],
  },
  {
    title: "Branchen-Workspace",
    items: [
      { href: "/dashboard/insurance", icon: ShieldCheck, label: "Versicherung" },
      { href: "/dashboard/realestate", icon: Building2, label: "Immobilien" },
      { href: "/dashboard/vc", icon: Landmark, label: "VC / Fonds" },
      { href: "/dashboard/consulting", icon: Briefcase, label: "Beratung" },
      { href: "/dashboard/recruiting", icon: Users, label: "Recruiting" },
    ],
  },
];

const BOTTOM_ITEMS = [
  { href: "/dashboard/team", icon: Users, label: "Team" },
  { href: "/dashboard/controlling", icon: BarChart3, label: "Controlling" },
  { href: "/dashboard/api-keys", icon: Key, label: "API-Keys" },
  { href: "/dashboard/billing", icon: CreditCard, label: "Abrechnung" },
  { href: "/dashboard/mobile", icon: Smartphone, label: "Mobile" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  { href: "/dashboard/settings/kanzlei", icon: Building2, label: "Kanzlei" },
  { href: "/dashboard/settings/security", icon: Shield, label: "Sicherheit" },
];

function useBrainStatus() {
  const [pages, setPages] = useState(0);
  const [entities, setEntities] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [dreamCycle, setDreamCycle] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setPages(data.total_pages ?? 0);
        setEntities(data.total_entities ?? 0);
        setLastSync(data.last_synced ?? null);
        setDreamCycle(data.dream_cycle_last ?? null);
      })
      .catch(() => {});
    // Activate real-time sync layer (lazy-connect; no-op if WS server unavailable)
    ensureRealtime();
  }, []);

  return { pages, entities, lastSync, dreamCycle };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { pages, entities, dreamCycle } = useBrainStatus();
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; type: "deadline" | "dream" | "system"; read: boolean }>>([]);

  // Poll for notifications (deadlines + dream cycle)
  useEffect(() => {
    async function loadNotifications() {
      try {
        const [deadlinePages, statsRaw] = await Promise.all([
          fetch("/api/pages?type=legal_deadline&limit=20").then((r) => r.ok ? r.json() as unknown : []),
          fetch("/api/stats").then((r) => r.ok ? r.json() as unknown : {}),
        ]);
        const stats = (statsRaw && typeof statsRaw === "object") ? statsRaw as Record<string, unknown> : {};
        const pages = Array.isArray(deadlinePages) ? deadlinePages : [];
        const now = new Date();
        const notifs: Array<{ id: string; title: string; message: string; type: "deadline" | "dream" | "system"; read: boolean }> = [];
        // Deadline notifications
        for (const p of pages) {
          const fm = (p.frontmatter ?? {}) as Record<string, unknown>;
          const dueStr = (fm.due_date || fm.date || p.created_at) as string | number | undefined;
          const due = dueStr ? new Date(dueStr) : new Date();
          const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (days <= 3 && days >= 0 && fm.status !== "done") {
            notifs.push({ id: `dl-${p.slug}`, title: "Frist bald fällig", message: `${p.title} — ${days} Tage`, type: "deadline", read: false });
          } else if (days < 0 && fm.status !== "done") {
            notifs.push({ id: `dl-${p.slug}`, title: "Frist überfällig", message: `${p.title} — ${Math.abs(days)} Tage überfällig`, type: "deadline", read: false });
          }
        }
        // Dream cycle notification
        const dcStr = stats.dream_cycle_last;
        if (dcStr && typeof dcStr === "string") {
          const dc = new Date(dcStr);
          const hours = (now.getTime() - dc.getTime()) / (1000 * 60 * 60);
          if (hours > 24) {
            notifs.push({ id: "dream", title: "Dream Cycle", message: `Letzter Lauf: vor ${Math.round(hours)} Stunden`, type: "dream", read: false });
          }
        }
        setNotifications(notifs);
      } catch {}
    }
    loadNotifications();
    const id = setInterval(loadNotifications, 60_000);
    return () => clearInterval(id);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function NetworkStatusBadge() {
    const online = useNetworkStatus();
    if (online) return null;
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-medium" title="Offline — Änderungen werden lokal zwischengespeichert">
        <CloudOff size={12} />
        Offline
      </div>
    );
  }

  function BrainSelector() {
    const { brains, activeBrain, selectBrain, loading } = useBrainSelector();
    if (loading || brains.length <= 1) return null;
    return (
      <select
        value={activeBrain?.slug || ""}
        onChange={(e) => {
          const b = brains.find((brain) => brain.slug === e.target.value);
          if (b) selectBrain(b);
        }}
        className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-2 py-1 text-xs text-[#8888aa] focus:outline-none focus:border-violet-500/50"
        title="Aktiven Brain wechseln"
      >
        {brains.map((b) => (
          <option key={b.slug} value={b.slug}>{b.name}</option>
        ))}
      </select>
    );
  }

  function SyncStatus({ collapsed }: { collapsed: boolean }) {
    const { pendingCount, syncing, syncPending } = useMutationQueue();
    if (collapsed || pendingCount === 0) return null;
    return (
      <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <div className="flex items-center justify-between">
          <span className="text-xs text-amber-400 font-medium">{pendingCount} Änderung(en) ausstehend</span>
          <button
            onClick={() => void syncPending()}
            disabled={syncing}
            className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-all"
          >
            {syncing ? "Sync…" : "Jetzt syncen"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#06060f] overflow-hidden">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-[#1e1e3a] bg-[#0a0a18] transition-all duration-200 shrink-0 z-50",
          "fixed inset-y-0 left-0 md:static",
          collapsed ? "md:w-14" : "md:w-56",
          mobileOpen ? "translate-x-0 w-56" : "-translate-x-full md:translate-x-0",
          "w-56"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-2.5 border-b border-[#1e1e3a] h-14 px-4",
          collapsed && "md:justify-center md:px-0"
        )}>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-[#8a8aa8] hover:text-[#e8e8f0] transition-colors mr-1"
          >
            <X size={18} />
          </button>
          <SigmaMark size={28} className="shrink-0" />
          <span className="font-display text-sm font-bold text-[#e8e8f0] tracking-tight md:hidden">
            Sigma<span className="text-violet-400">brain</span>
          </span>
          {!collapsed && (
            <span className="hidden md:inline font-display text-sm font-bold text-[#e8e8f0] tracking-tight">
              Sigma<span className="text-violet-400">brain</span>
            </span>
          )}
        </div>

        {/* Brain status */}
        {!collapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-[#0d0d1a] border border-[#1e1e3a]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#8a8aa8]">Brain Status</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">Active</span>
              </div>
            </div>
            <div className="text-xs text-[#8888aa] font-mono">{pages} pages · {entities} entities</div>
          </div>
        )}

        {/* Sync status */}
        <SyncStatus collapsed={collapsed} />

        {/* Nav — gruppiert nach Arbeitsbereich */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-3">
              {!collapsed && (
                <div className="px-3 mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-[#8a8aa8] font-semibold">{section.title}</span>
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-violet-600/15 text-violet-400 border border-violet-500/20"
                          : "text-[#8888aa] hover:text-[#e8e8f0] hover:bg-[#12122a]"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Dream Cycle indicator */}
        {!collapsed && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-amber-400 shrink-0" />
              <span className="text-xs text-amber-400 font-medium">Dream Cycle</span>
            </div>
            <p className="text-xs text-[#8a8aa8] mt-0.5">
              {dreamCycle
                ? `Letzter Lauf: ${new Date(dreamCycle).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                : "Inaktiv — Setup erforderlich"}
            </p>
          </div>
        )}

        {/* Bottom — Verwaltung */}
        <div className="px-2 pb-3 space-y-0.5 border-t border-[#1e1e3a] pt-3">
          {!collapsed && (
            <div className="px-3 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-[#8a8aa8] font-semibold">Verwaltung</span>
            </div>
          )}
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-violet-600/15 text-violet-400 border border-violet-500/20"
                    : "text-[#8888aa] hover:text-[#e8e8f0] hover:bg-[#12122a]"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#8a8aa8] hover:text-[#8888aa] hover:bg-[#12122a] transition-all duration-150",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Einklappen</span></>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-[#1e1e3a] bg-[#0a0a18] flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#8a8aa8] hover:text-[#e8e8f0] hover:bg-[#12122a] transition-all"
              aria-label="Menü öffnen"
            >
              <Menu size={18} />
            </button>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8aa8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(`/dashboard/brain?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery("");
                  }
                }}
                placeholder="Brain durchsuchen…"
                className="w-full bg-[#0d0d1a] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8a8aa8] hover:text-[#8888aa] hover:bg-[#12122a] transition-all relative"
              >
                <Bell size={15} />
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-72 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] shadow-xl z-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#e8e8f0]">Benachrichtigungen</span>
                    <button onClick={() => setNotifOpen(false)} className="text-[#8a8aa8] hover:text-[#e8e8f0]"><X size={14} /></button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#8888aa] py-2">Keine neuen Benachrichtigungen.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`rounded-lg border p-2.5 ${n.type === "deadline" ? "border-amber-500/20 bg-amber-500/5" : n.type === "dream" ? "border-violet-500/20 bg-violet-500/5" : "border-[#1e1e3a] bg-[#0a0a18]"}`}>
                        <div className="text-xs font-medium text-[#e8e8f0]">{n.title}</div>
                        <div className="text-[11px] text-[#8888aa]">{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <BrainSelector />
            <NetworkStatusBadge />
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
              <User size={14} className="text-violet-400" />
            </div>
            <button
              onClick={logout}
              title="Abmelden"
              aria-label="Abmelden"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8a8aa8] hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
