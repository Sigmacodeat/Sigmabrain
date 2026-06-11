"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SigmaMark } from "@/components/brand/logo";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/query", icon: MessageSquare, label: "Query" },
  { href: "/dashboard/brain", icon: BookOpen, label: "Brain" },
  { href: "/dashboard/graph", icon: Network, label: "Graph" },
  { href: "/dashboard/upload", icon: Upload, label: "Upload" },
];

const BOTTOM_ITEMS = [
  { href: "/dashboard/team", icon: Users, label: "Team" },
  { href: "/dashboard/billing", icon: CreditCard, label: "Abrechnung" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

function useBrainStatus() {
  const [pages, setPages] = useState(0);
  const [entities, setEntities] = useState(0);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setPages(data.total_pages ?? 0);
        setEntities(data.total_entities ?? 0);
      })
      .catch(() => {});
  }, []);

  return { pages, entities };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { pages, entities } = useBrainStatus();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
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
            className="md:hidden text-[#4a4a6a] hover:text-[#e8e8f0] transition-colors mr-1"
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
              <span className="text-xs text-[#4a4a6a]">Brain Status</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">Active</span>
              </div>
            </div>
            <div className="text-xs text-[#8888aa] font-mono">{pages} pages · {entities} entities</div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
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
        </nav>

        {/* Dream Cycle indicator */}
        {!collapsed && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-amber-400 shrink-0" />
              <span className="text-xs text-amber-400 font-medium">Dream Cycle</span>
            </div>
            <p className="text-xs text-[#4a4a6a] mt-0.5">Inaktiv — Setup erforderlich</p>
          </div>
        )}

        {/* Bottom */}
        <div className="px-2 pb-3 space-y-0.5 border-t border-[#1e1e3a] pt-3">
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
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#4a4a6a] hover:text-[#8888aa] hover:bg-[#12122a] transition-all duration-150",
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
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#4a4a6a] hover:text-[#e8e8f0] hover:bg-[#12122a] transition-all"
              aria-label="Menü öffnen"
            >
              <Menu size={18} />
            </button>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a6a]" />
              <input
                type="text"
                placeholder="Brain durchsuchen…"
                className="w-full bg-[#0d0d1a] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a4a6a] hover:text-[#8888aa] hover:bg-[#12122a] transition-all relative">
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
              <User size={14} className="text-violet-400" />
            </div>
            <button
              onClick={logout}
              title="Abmelden"
              aria-label="Abmelden"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a4a6a] hover:text-red-400 hover:bg-red-500/10 transition-all"
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
