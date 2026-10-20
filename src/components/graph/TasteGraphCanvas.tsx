"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  X,
  ExternalLink,
  Link2,
} from "lucide-react";

export interface GraphNode {
  id: string;
  title: string;
  coreType: string;
  typePath: string;
  heroImageUrl?: string | null;
  isPrivateMemo?: boolean;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  radius?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

export const ARCHETYPE_HALOS: Record<string, string> = {
  wine: "#c2410c", // Terracotta
  vinyl: "#4338ca", // Indigo
  book: "#15803d", // Forest Green
  cinema: "#d97706", // Amber
  place: "#059669", // Emerald
  place_spot: "#059669",
  recipe: "#b45309",
  art: "#7c3aed",
  private_memo: "#71717a",
  product: "#4f46e5",
  garment: "#0284c7",
  cosmetics: "#e11d48",
  electronics: "#06b6d4",
};

export function getNodeColor(typePath?: string | null, isPrivateMemo?: boolean): string {
  if (isPrivateMemo) return ARCHETYPE_HALOS.private_memo;
  const p = (typePath || "").toLowerCase();
  if (p.includes("wine")) return ARCHETYPE_HALOS.wine;
  if (p.includes("vinyl") || p.includes("music")) return ARCHETYPE_HALOS.vinyl;
  if (p.includes("book")) return ARCHETYPE_HALOS.book;
  if (p.includes("film") || p.includes("cinema") || p.includes("movie")) return ARCHETYPE_HALOS.cinema;
  if (p.includes("place") || p.includes("spot")) return ARCHETYPE_HALOS.place;
  if (p.includes("recipe") || p.includes("culinary")) return ARCHETYPE_HALOS.recipe;
  if (p.includes("garment")) return ARCHETYPE_HALOS.garment;
  if (p.includes("cosmetics")) return ARCHETYPE_HALOS.cosmetics;
  if (p.includes("electronics")) return ARCHETYPE_HALOS.electronics;
  if (p.includes("art")) return ARCHETYPE_HALOS.art;
  return ARCHETYPE_HALOS.product;
}

export function TasteGraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [serendipityItems, setSerendipityItems] = useState<any[]>([]);

  // Camera transform: pan & zoom
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1.0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);
  const dashOffsetRef = useRef(0);

  // 1. Fetch graph nodes and edges
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/graph/nodes-edges");
      if (res.ok) {
        const data = await res.json();
        const initialNodes: GraphNode[] = (data.nodes || []).map((n: any, idx: number) => ({
          ...n,
          x: n.x || Math.cos((idx / Math.max(1, data.nodes.length)) * 2 * Math.PI) * 220,
          y: n.y || Math.sin((idx / Math.max(1, data.nodes.length)) * 2 * Math.PI) * 220,
          vx: 0,
          vy: 0,
          radius: 24,
        }));
        setNodes(initialNodes);
        setEdges(data.edges || []);
      }
    } catch (err) {
      console.error("Failed to load taste graph:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Fetch serendipity when node is selected
  useEffect(() => {
    if (!selectedNode) {
      setSerendipityItems([]);
      return;
    }
    fetch(`/api/v1/graph/serendipity?saveId=${selectedNode.id}&limit=4`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.recommendations) {
          setSerendipityItems(data.recommendations);
        }
      })
      .catch(() => {});
  }, [selectedNode]);

  // 2. 60fps Physics & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localNodes = [...nodes];
    const nodeMap = new Map<string, GraphNode>();
    localNodes.forEach((n) => nodeMap.set(n.id, n));

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // Save transform
      ctx.save();
      ctx.translate(width / 2 + offset.x, height / 2 + offset.y);
      ctx.scale(scale, scale);

      // Force-directed relaxation step
      for (let i = 0; i < localNodes.length; i++) {
        for (let j = i + 1; j < localNodes.length; j++) {
          const a = localNodes[i];
          const b = localNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 180) {
            const force = (180 - dist) / 180;
            const fx = (dx / dist) * force * 1.2;
            const fy = (dy / dist) * force * 1.2;
            a.x -= fx;
            a.y -= fy;
            b.x += fx;
            b.y += fy;
          }
        }
      }

      // Edge spring attraction
      for (const edge of edges) {
        const u = nodeMap.get(edge.source);
        const v = nodeMap.get(edge.target);
        if (u && v) {
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 140;
          const force = (dist - targetDist) * 0.015;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          u.x += fx;
          u.y += fy;
          v.x -= fx;
          v.y -= fy;
        }
      }

      // Render Edges with pulsing animated dashed lines
      dashOffsetRef.current -= 0.4;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = dashOffsetRef.current;

      for (const edge of edges) {
        const u = nodeMap.get(edge.source);
        const v = nodeMap.get(edge.target);
        if (u && v) {
          ctx.beginPath();
          ctx.moveTo(u.x, u.y);

          // Subtle curved Bezier midpoint
          const mx = (u.x + v.x) / 2 + (u.y - v.y) * 0.1;
          const my = (u.y + v.y) / 2 + (v.x - u.x) * 0.1;
          ctx.quadraticCurveTo(mx, my, v.x, v.y);

          ctx.strokeStyle = "rgba(217, 119, 6, 0.45)"; // Amber synapse pulse
          ctx.lineWidth = Math.min(3, 1 + edge.weight);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]); // Reset dash

      // Render Nodes as Plinths with Archetype Halo
      for (const node of localNodes) {
        const haloColor = getNodeColor(node.typePath, node.isPrivateMemo);
        const isSelected = selectedNode?.id === node.id;

        // Plinth shadow
        ctx.beginPath();
        ctx.arc(node.x, node.y + 4, 24, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fill();

        // Archetype Color Halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, isSelected ? 30 : 25, 0, Math.PI * 2);
        ctx.fillStyle = haloColor;
        ctx.globalAlpha = isSelected ? 0.9 : 0.7;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Inner core plinth
        ctx.beginPath();
        ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = "#18181b"; // Dark zinc
        ctx.fill();
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.strokeStyle = "#fafafa";
        ctx.stroke();

        // Node Label
        ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = isSelected ? "#f59e0b" : "#e4e4e7";
        ctx.textAlign = "center";
        const shortTitle = node.title.length > 18 ? `${node.title.slice(0, 16)}...` : node.title;
        ctx.fillText(shortTitle, node.x, node.y + 36);
      }

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [nodes, edges, offset, scale, selectedNode]);

  // Canvas Mouse Interactions (Pan & Select)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Check click hit detection on nodes
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left - canvas.width / 2 - offset.x) / scale;
    const clickY = (e.clientY - rect.top - canvas.height / 2 - offset.y) / scale;

    const clicked = nodes.find((n) => {
      const dx = n.x - clickX;
      const dy = n.y - clickY;
      return Math.sqrt(dx * dx + dy * dy) <= (n.radius || 24) + 6;
    });

    if (clicked) {
      setSelectedNode(clicked);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setScale((prev) => Math.min(2.5, Math.max(0.4, prev * zoomFactor)));
  };

  return (
    <div
      data-testid="taste-graph-canvas"
      className="relative w-full h-[85vh] rounded-3xl bg-neutral-950 overflow-hidden border border-neutral-800 shadow-2xl flex"
    >
      {/* 60fps HTML5 Canvas Stage */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 backdrop-blur-md text-white shadow-lg">
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(2.5, s * 1.2))}
          className="p-2 rounded-xl hover:bg-neutral-800 transition cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-neutral-300" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.4, s * 0.8))}
          className="p-2 rounded-xl hover:bg-neutral-800 transition cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-neutral-300" />
        </button>
        <button
          type="button"
          onClick={() => {
            setOffset({ x: 0, y: 0 });
            setScale(1.0);
          }}
          className="p-2 rounded-xl hover:bg-neutral-800 transition cursor-pointer"
          title="Reset viewpoint"
        >
          <RotateCcw className="w-4 h-4 text-neutral-300" />
        </button>
      </div>

      {/* Archetype Color Legend */}
      <div className="absolute bottom-4 left-4 z-20 hidden md:flex items-center gap-3 p-2.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 backdrop-blur-md text-[10px] font-mono text-neutral-400">
        <span className="font-bold uppercase text-neutral-300">Halos:</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ARCHETYPE_HALOS.wine }} />
          Wine
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ARCHETYPE_HALOS.vinyl }} />
          Vinyl
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ARCHETYPE_HALOS.cinema }} />
          Cinema
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ARCHETYPE_HALOS.book }} />
          Books
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ARCHETYPE_HALOS.place }} />
          Places
        </span>
      </div>

      {/* Right-hand Synapse Inspector Drawer */}
      {selectedNode && (
        <div
          data-testid="synapse-inspector-drawer"
          className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-neutral-900/95 border-l border-neutral-800 p-6 overflow-y-auto backdrop-blur-xl shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 z-30 text-white"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>Synapse Inspector</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-6">
              <div
                className="w-full h-32 rounded-2xl overflow-hidden mb-3 bg-neutral-800 flex items-center justify-center border border-neutral-700/80"
              >
                {selectedNode.heroImageUrl ? (
                  <img
                    src={selectedNode.heroImageUrl}
                    alt={selectedNode.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: getNodeColor(selectedNode.typePath, selectedNode.isPrivateMemo) }}
                  >
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                {selectedNode.typePath}
              </span>
              <h3 className="font-serif text-lg font-bold text-neutral-100 leading-snug">
                {selectedNode.title}
              </h3>
            </div>

            {/* Serendipitous Cross-Archetype Links */}
            <div className="space-y-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 block">
                Serendipitous Resonance
              </span>
              {serendipityItems.length === 0 ? (
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-400 font-mono">
                  Calculating cross-vertical serendipity pairs...
                </div>
              ) : (
                <div className="space-y-2">
                  {serendipityItems.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-200">
                        <span className="truncate max-w-[190px]">{rec.targetTitle}</span>
                        <span className="text-amber-400 font-mono text-[10px]">
                          {(rec.cosineSimilarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-mono line-clamp-1">
                        {rec.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
