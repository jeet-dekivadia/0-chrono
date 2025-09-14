"use client";

import * as React from "react";
import {
  select,
  zoom as d3zoom,
  zoomIdentity,
  drag as d3drag,
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3";

/* -------------------- Types -------------------- */

type NodeType =
  | "Patient"
  | "Drug"
  | "Condition"
  | "Allergy"
  | "LabTest"
  | "Culture"
  | "MedicationAdministration"
  | "Appointment"
  | "Guideline";

type EdgeType =
  | "prescribed"
  | "interacts_with"
  | "contraindicated_with"
  | "has_condition"
  | "has_allergy"
  | "has_lab"
  | "has_culture"
  | "has_admin_event"
  | "has_appointment"
  | "guideline";

type Severity = "low" | "medium" | "high";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  body?: string;
  degree?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  id?: string;
  source: string; // node id
  target: string; // node id
  type: EdgeType;
  severity?: Severity; // for interaction edges
  confidence?: number; // 0..1 → stroke width
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/* -------------------- Visual helpers -------------------- */

function nodeColor(t: NodeType) {
  switch (t) {
    case "Patient":
      return "#2563eb"; // blue-600
    case "Drug":
      return "#16a34a"; // green-600
    case "Condition":
      return "#ea580c"; // orange-600
    case "Allergy":
      return "#e11d48"; // rose-600
    case "Appointment":
      return "#7c3aed"; // violet-600
    case "Guideline":
      return "#0ea5e9"; // sky-600
    default:
      return "#6b7280"; // zinc-500
  }
}

function nodeRadius(t: NodeType, degree = 0) {
  const baseSize = t === "Patient" ? 16 : 12;
  return baseSize + Math.min(degree * 2, 8);
}

function edgeColor(e: GraphEdge) {
  if (e.type === "interacts_with" || e.type === "contraindicated_with") {
    if (e.severity === "high") return "#dc2626"; // red-600
    if (e.severity === "medium") return "#f59e0b"; // amber-500
    return "#10b981"; // emerald-500 (low)
  }
  return "#94a3b8"; // slate-400
}

function edgeWidth(conf = 0.7) {
  return 1 + Math.max(0, Math.min(1, conf)) * 3;
}

function labelVisible(zoomK: number, degree = 0) {
  return zoomK >= 0.8 || degree >= 2;
}

/* -------------------- Component -------------------- */

export function GraphCanvas({
  data,
  onSelect,
}: {
  data?: GraphData;
  onSelect?: (payload: { node?: GraphNode; edge?: GraphEdge }) => void;
}) {
  const [serverData, setServerData] = React.useState<GraphData | null>(null);
  const [hovered, setHovered] = React.useState<{
    node: GraphNode;
    x: number;
    y: number;
  } | null>(null);
  const [queryText, setQueryText] = React.useState("");
  const [ragLoading, setRagLoading] = React.useState(false);
  const [ragAnswer, setRagAnswer] = React.useState<string | null>(null);
  const [ragError, setRagError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const simulationRef = React.useRef<ReturnType<typeof forceSimulation> | null>(null);
  const transformRef = React.useRef<any>(zoomIdentity as any);
  
  // Stable graph data to prevent unnecessary re-renders
  const graphData = React.useMemo(() => {
    const effective = serverData ?? data ?? { nodes: [], edges: [] };
    const degreeMap: Record<string, number> = {};
    effective.edges.forEach((e) => {
      degreeMap[e.source] = (degreeMap[e.source] || 0) + 1;
      degreeMap[e.target] = (degreeMap[e.target] || 0) + 1;
    });

    const nodes = effective.nodes.map((n) => ({
      ...n,
      degree: degreeMap[n.id] || 0,
    }));

    const edges = effective.edges.map((e, i) => ({
      id: e.id ?? `edge-${i}`,
      ...e,
    }));

    return { nodes, edges };
  }, [data, serverData]);

  // Try to fetch from backend if available (no auth; dev only)
  React.useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    async function fetchGraph() {
      try {
        const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
        const resp = await fetch(`${base}/graph`, { signal: controller.signal });
        if (!resp.ok) return;
        const json = (await resp.json()) as GraphData;
        if (!aborted && json && Array.isArray(json.nodes) && Array.isArray(json.edges)) {
          setServerData(json);
        }
      } catch (_) {
        // silent fail in demo mode
      }
    }
    fetchGraph();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, []);

  // GraphRAG query submit
  const runGraphRag = React.useCallback(async () => {
    const q = queryText.trim();
    if (!q || ragLoading) return;
    setRagAnswer(null);
    setRagError(null);
    setRagLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
      const resp = await fetch(`${base}/graph-rag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 6, neighbor_k: 4 }),
      });
      const ct = resp.headers.get("content-type") || "";
      const raw = await resp.text();
      let data: any = null;
      if (ct.includes("application/json")) {
        try { data = JSON.parse(raw); } catch (_) {}
      }
      if (!resp.ok) {
        const msg = data && data.error ? String(data.error) : raw ? String(raw).slice(0, 300) : `status ${resp.status}`;
        throw new Error(msg);
      }
      if (data && data.answer != null) {
        setRagAnswer(String(data.answer));
      } else {
        setRagAnswer(raw);
      }
    } catch (e: any) {
      setRagError(String(e && e.message ? e.message : e));
    } finally {
      setRagLoading(false);
    }
  }, [queryText, ragLoading]);

  // Debounced resize handler
  const resizeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  React.useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    // Get initial dimensions
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear previous content
    const svgSelection = select(svg);
    svgSelection.selectAll("*").remove();

    // Set up SVG
    svgSelection
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "transparent");

    // Create defs for patterns and markers
    const defs = svgSelection.append("defs");
    
    // Gradient for nodes
    const gradient = defs.append("linearGradient")
      .attr("id", "nodeGradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "rgba(255,255,255,0.3)");
    
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "rgba(0,0,0,0.1)");

    // Arrow marker
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8")
      .attr("opacity", 0.8);

    // Create main group for zoom/pan
    const mainGroup = svgSelection.append("g").attr("class", "main-group");

    // Create links
    const linkGroup = mainGroup.append("g").attr("class", "links");
    const links = linkGroup
      .selectAll("line")
      .data(graphData.edges)
      .join("line")
      .attr("stroke", (d: any) => edgeColor(d))
      .attr("stroke-width", (d: any) => edgeWidth(d.confidence))
      .attr("stroke-opacity", 0.7)
      .attr("marker-end", "url(#arrowhead)")
      .style("cursor", "pointer")
      .on("click", (event: any, d: any) => {
        event.stopPropagation();
        onSelect?.({ edge: d });
      })
      .on("mouseenter", (event: any) => {
        select(event.currentTarget as any).attr("stroke-opacity", 1);
      })
      .on("mouseleave", (event: any) => {
        select(event.currentTarget as any).attr("stroke-opacity", 0.7);
      });

    // Create nodes
    const nodeGroup = mainGroup.append("g").attr("class", "nodes");
    const nodes = nodeGroup
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", (d: GraphNode) => nodeRadius(d.type, d.degree))
      .attr("fill", (d: GraphNode) => nodeColor(d.type))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .style("filter", "url(#nodeGradient)")
      .style("cursor", "grab")
      .on("click", (event: any, d: GraphNode) => {
        event.stopPropagation();
        onSelect?.({ node: d });
      })
      .on("mouseenter", (event: any, d: GraphNode) => {
        select(event.currentTarget as any)
          .transition()
          .duration(150)
          .attr("r", nodeRadius(d.type, d.degree) + 3)
          .attr("stroke-width", 3);
        const rect = container.getBoundingClientRect();
        setHovered({ node: d, x: event.clientX - rect.left, y: event.clientY - rect.top });
      })
      .on("mousemove", (event: any, d: GraphNode) => {
        const rect = container.getBoundingClientRect();
        setHovered((prev) => {
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          return prev && prev.node.id === d.id ? { ...prev, x, y } : { node: d, x, y };
        });
      })
      .on("mouseleave", (event: any, d: GraphNode) => {
        select(event.currentTarget as any)
          .transition()
          .duration(150)
          .attr("r", nodeRadius(d.type, d.degree))
          .attr("stroke-width", 2);
        setHovered(null);
      });

    // Create labels
    const labelGroup = mainGroup.append("g").attr("class", "labels");
    const labels = labelGroup
      .selectAll("text")
      .data(graphData.nodes)
      .join("text")
      .text((d: GraphNode) => d.label)
      .attr("font-size", 11)
      .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
      .attr("font-weight", "500")
      .attr("fill", "#374151")
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "central")
      .attr("paint-order", "stroke fill")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round")
      .style("pointer-events", "none")
      .style("user-select", "none")
      .attr("opacity", 0);

    // Set up force simulation
    const simulation = forceSimulation(graphData.nodes as any)
      .force("link", forceLink(graphData.edges as any)
        .id((d: any) => d.id as string)
        .distance((d: any) => {
          const sourceRadius = nodeRadius((d.source as GraphNode).type, (d.source as GraphNode).degree);
          const targetRadius = nodeRadius((d.target as GraphNode).type, (d.target as GraphNode).degree);
          return 80 + sourceRadius + targetRadius;
        })
        .strength(0.6)
      )
      .force("charge", forceManyBody().strength(-400))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide().radius((d: any) => nodeRadius((d as GraphNode).type, (d as GraphNode).degree) + 10))
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    simulationRef.current = simulation;

    // Set up drag behavior
    const dragBehavior = d3drag()
      .on("start", (event: any, d: GraphNode) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        select(event.currentTarget as any).style("cursor", "grabbing");
      })
      .on("drag", (event: any, d: GraphNode) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: any, d: GraphNode) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        select(event.currentTarget as any).style("cursor", "grab");
      });

    nodes.call(dragBehavior as any);

    // Set up zoom behavior
    const zoomBehavior = d3zoom()
      .scaleExtent([0.3, 3])
      .on("zoom", (event: any) => {
        const transform = event.transform;
        transformRef.current = transform;
        mainGroup.attr("transform", transform.toString());
        
        // Update label visibility based on zoom level
        labels.attr("opacity", (d: GraphNode) => labelVisible(transform.k, d.degree) ? 1 : 0);
      });

    svgSelection.call(zoomBehavior as any);

    // Simulation tick handler
    simulation.on("tick", () => {
      links
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodes
        .attr("cx", (d: GraphNode) => d.x!)
        .attr("cy", (d: GraphNode) => d.y!);

      labels
        .attr("x", (d: GraphNode) => (d.x || 0) + nodeRadius(d.type, d.degree) + 8)
        .attr("y", (d: GraphNode) => d.y || 0);
    });

    // Resize observer for responsive behavior
    const resizeObserver = new ResizeObserver((entries) => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        for (const entry of entries) {
          const { width: newWidth, height: newHeight } = entry.contentRect;
          svgSelection.attr("viewBox", `0 0 ${newWidth} ${newHeight}`);
          simulation.force("center", forceCenter(newWidth / 2, newHeight / 2));
          simulation.alpha(0.1).restart();
        }
      }, 100);
    });

    resizeObserver.observe(container);

    // Cleanup function
    return () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeObserver.disconnect();
      simulation.stop();
      simulationRef.current = null;
    };
  }, [graphData, onSelect]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 bg-gradient-to-br from-zinc-50/50 to-white/50 dark:from-zinc-900/50 dark:to-zinc-800/50 backdrop-blur-sm shadow-sm overflow-hidden"
      style={{ 
        minHeight: "600px",
        contain: "layout style paint"
      }}
    >
      {/* Query bar */}
      <div className="absolute inset-x-0 top-0 z-20 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/80">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runGraphRag(); }}
            placeholder="Ask a question about this graph..."
            className="flex-1 bg-transparent outline-none text-sm text-zinc-900 placeholder-zinc-400 dark:text-zinc-100"
            aria-label="Ask a question about this graph"
          />
          <button
            onClick={runGraphRag}
            disabled={ragLoading || !queryText.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {ragLoading ? "Thinking..." : "Ask"}
          </button>
        </div>
        {(ragAnswer || ragError) && (
          <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-zinc-200/70 bg-white/90 p-3 text-sm leading-relaxed text-zinc-800 shadow-sm backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/80 dark:text-zinc-200">
            {ragError ? (
              <div className="text-red-600 dark:text-red-400">{ragError}</div>
            ) : (
              <div style={{ whiteSpace: "pre-wrap" }}>{ragAnswer}</div>
            )}
          </div>
        )}
      </div>
      <svg
        ref={svgRef}
        className="w-full h-full"
        role="img"
        aria-label="Interactive Knowledge Graph"
      />
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs translate-x-3 translate-y-3 rounded-md border border-zinc-200/70 bg-white/95 p-3 text-xs shadow-lg backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/90"
          style={{ left: hovered.x, top: hovered.y }}
          role="dialog"
          aria-live="polite"
        >
          <div className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {hovered.node.label}
          </div>
          <div className="mb-2 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {hovered.node.type}
          </div>
          <div className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {hovered.node.body ?? "No additional details available."}
          </div>
        </div>
      )}
    </div>
  );
}

export default GraphCanvas;