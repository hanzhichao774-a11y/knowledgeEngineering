import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useResultStore } from '../../store/resultStore';
import styles from './RightPanel.module.css';

const COMMUNITY_PALETTE = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
  '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#facc15',
];

const TYPE_COLORS: Record<string, string> = {
  entity: '#3b82f6',
  concept: '#22c55e',
  event: '#f59e0b',
  metric: '#06b6d4',
  organization: '#8b5cf6',
  person: '#ec4899',
  location: '#14b8a6',
  time: '#f97316',
  document: '#64748b',
};

function getNodeColor(node: { community?: number; type?: string }): string {
  if (node.community !== undefined && node.community >= 0) {
    return COMMUNITY_PALETTE[node.community % COMMUNITY_PALETTE.length];
  }
  return TYPE_COLORS[node.type ?? 'entity'] ?? TYPE_COLORS.entity;
}

function getNodeAlpha(confidence?: number): number {
  if (confidence === undefined) return 1;
  return Math.max(0.4, confidence);
}

interface GraphRendererProps {
  width: number;
  height: number;
  chargeStrength?: number;
  linkDistance?: number;
  nodes: Array<{ id: string; label: string; type: string; community?: number; confidence?: number }>;
  links: Array<{ source: string; target: string; label?: string; weight?: number }>;
}

function GraphRenderer({
  width,
  height,
  chargeStrength = -300,
  linkDistance = 120,
  nodes,
  links,
}: GraphRendererProps) {
  const fgRef = useRef<any>(null);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(chargeStrength);
    fg.d3Force('link')?.distance(linkDistance);
    fg.d3Force('center')?.strength(0.05);
  }, [chargeStrength, linkDistance, nodes, links]);

  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(400, 50);
  }, []);

  const handleZoomIn = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoom(fg.zoom().k * 1.4, 300);
  }, []);

  const handleZoomOut = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoom(fg.zoom().k / 1.4, 300);
  }, []);

  const handleZoomReset = useCallback(() => {
    fgRef.current?.zoomToFit(400, 50);
  }, []);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D) => {
      const label = node.label as string;
      const color = getNodeColor(node);
      const alpha = getNodeAlpha(node.confidence);
      const fontSize = 12;
      ctx.font = `${fontSize}px -apple-system, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const padding = 10;
      const w = textWidth + padding * 2;
      const h = fontSize + padding * 1.5;
      const x = node.x! - w / 2;
      const y = node.y! - h / 2;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color + '20';
      ctx.strokeStyle = color;
      ctx.lineWidth = node.confidence !== undefined && node.confidence < 0.7 ? 1 : 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, node.x!, node.y!);
      ctx.globalAlpha = 1;
    },
    [],
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      const start = link.source;
      const end = link.target;
      if (typeof start !== 'object' || typeof end !== 'object') return;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;
      const ux = dx / len;
      const uy = dy / len;

      const lineAlpha = Math.min(1, (link.weight ?? 0.5) + 0.3);
      ctx.strokeStyle = `rgba(148,163,184,${lineAlpha * 0.5})`;
      ctx.lineWidth = 1 + (link.weight ?? 0.5);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const arrowLen = 7;
      const arrowX = end.x - ux * 14;
      const arrowY = end.y - uy * 14;
      ctx.fillStyle = `rgba(148,163,184,${lineAlpha * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(arrowX + ux * arrowLen, arrowY + uy * arrowLen);
      ctx.lineTo(arrowX - uy * 3.5, arrowY + ux * 3.5);
      ctx.lineTo(arrowX + uy * 3.5, arrowY - ux * 3.5);
      ctx.closePath();
      ctx.fill();

      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const labelText = link.label ?? '';
      if (labelText) {
        ctx.font = '10px -apple-system, sans-serif';
        const tw = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(15,23,42,0.8)';
        ctx.fillRect(mx - tw / 2 - 4, my - 8, tw + 8, 14);
        ctx.fillStyle = 'rgba(226,232,240,0.95)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, mx, my);
      }
    },
    [],
  );

  const nodePointerAreaPaint = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const label = node.label as string;
      ctx.font = '12px -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      const w = tw + 24;
      const h = 28;
      ctx.fillStyle = color;
      ctx.fillRect(node.x! - w / 2, node.y! - h / 2, w, h);
    },
    [],
  );

  return (
    <div className={styles.graphRendererWrap}>
      <div className={styles.graphToolbar}>
        <button className={styles.graphToolBtn} onClick={handleZoomIn} title="放大">+</button>
        <button className={styles.graphToolBtn} onClick={handleZoomOut} title="缩小">−</button>
        <button className={styles.graphToolBtn} onClick={handleZoomReset} title="适应画布">⟲</button>
      </div>
      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes, links }}
        width={width}
        height={height}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalArrowLength={0}
        nodePointerAreaPaint={nodePointerAreaPaint}
        cooldownTicks={150}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        onEngineStop={handleEngineStop}
        backgroundColor="transparent"
      />
    </div>
  );
}

function GraphModal({
  nodes,
  links,
  communityLegend,
  onClose,
}: {
  nodes: GraphRendererProps['nodes'];
  links: GraphRendererProps['links'];
  communityLegend: Array<{ id: number; label: string; color: string }>;
  onClose: () => void;
}) {
  const [dims, setDims] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const onResize = () => setDims({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.graphOverlay} onClick={onClose}>
      <div className={styles.graphModalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.graphModalHeader}>
          <div className={styles.graphLegend} style={{ border: 'none', padding: '0' }}>
            {communityLegend.map((item) => (
              <span key={item.id} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <button className={styles.graphModalClose} onClick={onClose} title="关闭 (Esc)">✕</button>
        </div>
        <GraphRenderer
          width={dims.width - 48}
          height={dims.height - 80}
          chargeStrength={-400}
          linkDistance={160}
          nodes={nodes}
          links={links}
        />
      </div>
    </div>
  );
}

export function GraphTab() {
  const graphData = useResultStore((s) => s.graphData);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 340, height: 500 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({
          width: entry.contentRect.width || 340,
          height: entry.contentRect.height || 500,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fgNodes = useMemo(() => {
    if (!graphData) return [];
    return graphData.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      community: n.community,
      confidence: n.confidence,
    }));
  }, [graphData]);

  const fgLinks = useMemo(() => {
    if (!graphData) return [];
    const edges = graphData.links ?? graphData.edges ?? [];
    return edges.map((e) => ({
      source: e.source,
      target: e.target,
      label: e.label,
      weight: e.weight,
    }));
  }, [graphData]);

  const communityLegend = useMemo(() => {
    if (!graphData) return [];
    const communities = new Map<number, string[]>();
    for (const node of graphData.nodes) {
      if (node.community !== undefined && node.community >= 0) {
        const members = communities.get(node.community) ?? [];
        members.push(node.label);
        communities.set(node.community, members);
      }
    }
    return Array.from(communities.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .map(([id, members]) => ({
        id,
        label: `C${id} (${members.length})`,
        color: COMMUNITY_PALETTE[id % COMMUNITY_PALETTE.length],
      }));
  }, [graphData]);

  if (!graphData) {
    return (
      <div className={styles.emptyState}>
        <p>暂无图谱数据</p>
        <p className={styles.emptyHint}>知识图谱将在执行完成后生成</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.resultCard}>
        <div className={styles.resultCardHeader}>
          <span className={styles.resultIcon}>🕸️</span>
          <span className={styles.resultTitle}>知识图谱预览</span>
          <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>
            {graphData.nodes.length} 节点 · {(graphData.links ?? graphData.edges ?? []).length} 边
          </span>
          <button
            className={styles.graphFullscreenBtn}
            onClick={() => setIsFullscreen(true)}
            title="全屏查看"
          >
            ⤢
          </button>
        </div>
        <div className={styles.resultCardBody} style={{ padding: 0 }}>
          {communityLegend.length > 0 && (
            <div className={styles.graphLegend}>
              {communityLegend.map((item) => (
                <span key={item.id} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          )}
          <div ref={containerRef} className={styles.graphContainer}>
            <GraphRenderer
              width={dims.width}
              height={dims.height}
              nodes={fgNodes}
              links={fgLinks}
            />
          </div>
        </div>
      </div>

      {isFullscreen && (
        <GraphModal
          nodes={fgNodes}
          links={fgLinks}
          communityLegend={communityLegend}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div>
  );
}
