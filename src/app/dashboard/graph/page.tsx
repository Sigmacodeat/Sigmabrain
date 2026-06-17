"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Network, ZoomIn, ZoomOut, Maximize2, RefreshCw, Users, Building2, Lightbulb, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { GraphNode, GraphLink } from "@/lib/types";

const NODE_COLORS: Record<string, string> = {
  person: "#60a5fa",
  company: "#34d399",
  idea: "#a78bfa",
  document: "#fbbf24",
  event: "#f97316",
  place: "#2dd4bf",
};

type LayoutNode = GraphNode & { x: number; y: number };

export default function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.brain.graph();
      setNodes(data.nodes);
      setLinks(data.links);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Graph konnte nicht geladen werden");
      setNodes([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred so the loading-state flip is not a synchronous setState
    // inside the effect body (react-hooks/set-state-in-effect).
    const timer = setTimeout(loadGraph, 0);
    return () => clearTimeout(timer);
  }, [loadGraph]);

  // Layout is purely derived from the node list — no state, no effect.
  const layoutNodes = useMemo<LayoutNode[]>(() => {
    if (nodes.length === 0) return [];
    const W = 800;
    const H = 600;
    return nodes.map((n, i) => ({
      ...n,
      x: W / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 180,
      y: H / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 130,
    }));
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layoutNodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const scale = zoom;
    const offsetX = (W * (1 - scale)) / 2;
    const offsetY = (H * (1 - scale)) / 2;

    let animFrame: number;
    let tick = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      tick += 0.005;

      links.forEach((link) => {
        const srcId = typeof link.source === "string" ? link.source : link.source.id;
        const tgtId = typeof link.target === "string" ? link.target : link.target.id;
        const src = layoutNodes.find((n) => n.id === srcId);
        const tgt = layoutNodes.find((n) => n.id === tgtId);
        if (!src || !tgt) return;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = "rgba(124, 58, 237, 0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        ctx.fillStyle = "#8a8a98";
        ctx.font = "10px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(link.type, midX, midY - 4);
      });

      layoutNodes.forEach((node) => {
        const color = NODE_COLORS[node.type] || "#585866";
        const radius = 8 + node.connections * 2;
        const pulse = Math.sin(tick * 2) * 2;

        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius + 8);
        gradient.addColorStop(0, color + "40");
        gradient.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color + "20";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#15151d";
        ctx.font = "12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.name, node.x, node.y + radius + 16);

        ctx.fillStyle = "#8a8a98";
        ctx.font = "10px JetBrains Mono, monospace";
        ctx.fillText(node.type, node.x, node.y + radius + 28);
      });

      ctx.restore();
      animFrame = requestAnimationFrame(draw);
    };

    draw();

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / scale;
      const y = (e.clientY - rect.top - offsetY) / scale;

      const hit = layoutNodes.find((n) => {
        const dx = n.x - x;
        const dy = n.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 20;
      });

      setSelected(hit ? nodes.find((n) => n.id === hit.id) || null : null);
    };

    canvas.addEventListener("click", handleClick);

    return () => {
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener("click", handleClick);
    };
  }, [layoutNodes, links, nodes, zoom]);

  const isEmpty = !loading && nodes.length === 0;

  const typeIconMap: Record<string, React.ElementType> = {
    person: Users,
    company: Building2,
    idea: Lightbulb,
    document: FileText,
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 relative bg-[#f5f6f9]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 size={32} className="animate-spin text-[#585866] mb-3" />
            <p className="text-sm text-[#585866]">Graph wird geladen…</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Network size={40} className="text-[#e2e4ec] mb-4" />
            <h3 className="text-lg font-semibold text-[#15151d] mb-2">Graph ist leer</h3>
            <p className="text-sm text-[#585866] mb-2">Lade Dokumente hoch um den Wissensgraph zu befüllen</p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair"
              style={{ width: "100%", height: "100%" }}
            />

            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#ffffff]/90 backdrop-blur border border-[#e2e4ec] rounded-lg p-1">
                <button
                  onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
                  className="p-2 rounded text-[#585866] hover:text-[#15151d] hover:bg-[#e2e4ec] transition-all"
                >
                  <ZoomIn size={14} />
                </button>
                <span className="text-xs text-[#585866] px-2 font-mono">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
                  className="p-2 rounded text-[#585866] hover:text-[#15151d] hover:bg-[#e2e4ec] transition-all"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="p-2 rounded text-[#585866] hover:text-[#15151d] hover:bg-[#e2e4ec] transition-all"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
              <button
                onClick={loadGraph}
                className="p-2 bg-[#ffffff]/90 backdrop-blur border border-[#e2e4ec] rounded-lg text-[#585866] hover:text-[#15151d] hover:bg-[#eceef3] transition-all"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="absolute bottom-4 left-4 bg-[#ffffff]/90 backdrop-blur border border-[#e2e4ec] rounded-xl p-4">
              <p className="text-xs text-[#585866] uppercase tracking-wider font-medium mb-3">Legende</p>
              <div className="space-y-2">
                {Object.entries(NODE_COLORS).slice(0, 4).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: color, backgroundColor: color + "20" }} />
                    <span className="text-xs text-[#585866] capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute top-4 right-4 bg-[#ffffff]/90 backdrop-blur border border-[#e2e4ec] rounded-xl p-4 text-right">
              <div className="text-xs text-[#585866] mb-2">Graph</div>
              <div className="space-y-1">
                <div className="text-sm font-mono text-[#15151d]">{nodes.length} <span className="text-[#585866]">Knoten</span></div>
                <div className="text-sm font-mono text-[#15151d]">{links.length} <span className="text-[#585866]">Kanten</span></div>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="w-72 shrink-0 border-l border-[#e2e4ec] bg-[#ffffff] overflow-y-auto p-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (NODE_COLORS[selected.type] || "#585866") + "20", border: `1px solid ${(NODE_COLORS[selected.type] || "#585866")}40` }}>
              {(() => {
                const Icon = typeIconMap[selected.type] || FileText;
                return <Icon size={16} style={{ color: NODE_COLORS[selected.type] || "#585866" }} />;
              })()}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#15151d]">{selected.name}</h3>
              <Badge variant={(selected.type as Parameters<typeof Badge>[0]["variant"]) || "default"} className="mt-1">
                {selected.type}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#585866] uppercase tracking-wider mb-2">Slug</p>
              <p className="text-sm font-mono text-violet-600 bg-violet-500/10 px-3 py-2 rounded-lg">{selected.id}</p>
            </div>
            <div>
              <p className="text-xs text-[#585866] uppercase tracking-wider mb-2">Verbindungen</p>
              <p className="text-2xl font-bold text-[#15151d] font-mono">{selected.connections}</p>
            </div>

            <div>
              <p className="text-xs text-[#585866] uppercase tracking-wider mb-2">Kanten</p>
              {links.filter((l) => {
                const src = typeof l.source === "string" ? l.source : l.source.id;
                const tgt = typeof l.target === "string" ? l.target : l.target.id;
                return src === selected.id || tgt === selected.id;
              }).map((link, i) => {
                const src = typeof link.source === "string" ? link.source : link.source.id;
                const tgt = typeof link.target === "string" ? link.target : link.target.id;
                const other = src === selected.id ? tgt : src;
                const otherNode = nodes.find((n) => n.id === other);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs mb-2">
                    <span className="font-mono text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded">{link.type}</span>
                    <span className="text-[#585866]">→</span>
                    <span className="text-[#15151d]">{otherNode?.name || other}</span>
                  </div>
                );
              })}
            </div>

            <Button variant="outline" size="md" className="w-full" onClick={() => window.location.href = `/dashboard/brain/${selected.id.split("/").map(encodeURIComponent).join("/")}`}>
              Seite öffnen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}