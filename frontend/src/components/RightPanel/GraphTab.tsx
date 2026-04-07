import { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useResultStore } from '../../store/resultStore';
import styles from './RightPanel.module.css';

const nodeColors: Record<string, string> = {
  class: '#f59e0b',
  entity: '#3b82f6',
  concept: '#22c55e',
  attribute: '#6366f1',
  rule: '#a855f7',
};

const nodeBg: Record<string, string> = {
  class: 'rgba(245,158,11,0.15)',
  entity: 'rgba(59,130,246,0.12)',
  concept: 'rgba(34,197,94,0.12)',
  attribute: 'rgba(99,102,241,0.12)',
  rule: 'rgba(168,85,247,0.12)',
};

const legendItems = [
  { type: 'class', label: '本体类' },
  { type: 'entity', label: '实体' },
  { type: 'attribute', label: '属性' },
];

interface GraphRendererProps {
  width: number;
  height: number;
  chargeStrength?: number;
  linkDistance?: number;
  nodes: { id: string; label: string; type: string }[];
  links: { source: string; target: string; label?: string }[];
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
    const { k, x, y } = fg.zoom();
    fg.zoom(k * 1.4, 300);
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
      const type = (node.type as string) || 'entity';
      const isClass = type === 'class';
      const fontSize = isClass ? 13 : 12;
      ctx.font = `${isClass ? 'bold ' : ''}${fontSize}px -apple-system, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const padding = isClass ? 12 : 10;
      const w = textWidth + padding * 2;
      const h = fontSize + padding * 1.5;
      const x = node.x! - w / 2;
      const y = node.y! - h / 2;

      ctx.fillStyle = nodeBg[type] ?? nodeBg.entity;
      ctx.strokeStyle = nodeColors[type] ?? nodeColors.entity;
      ctx.lineWidth = isClass ? 2.5 : 1.5;
      ctx.beginPath();
      if (isClass) {
        ctx.ellipse(node.x!, node.y!, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.roundRect(x, y, w, h, 5);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = nodeColors[type] ?? nodeColors.entity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, node.x!, node.y!);
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

      ctx.strokeStyle = 'rgba(148,163,184,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const arrowLen = 7;
      const arrowX = end.x - ux * 14;
      const arrowY = end.y - uy * 14;
      ctx.fillStyle = 'rgba(148,163,184,0.7)';
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
        <button
          className={styles.graphToolBtn}
          onClick={handleZoomIn}
          title="放大"
        >
          +
        </button>
        <button
          className={styles.graphToolBtn}
          onClick={handleZoomOut}
          title="缩小"
        >
          −
        </button>
        <button
          className={styles.graphToolBtn}
          onClick={handleZoomReset}
          title="适应画布"
        >
          ⟲
        </button>
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
  onClose,
}: {
  nodes: { id: string; label: string; type: string }[];
  links: { source: string; target: string; label?: string }[];
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
      <div
        className={styles.graphModalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.graphModalHeader}>
          <div className={styles.graphLegend} style={{ border: 'none', padding: '0' }}>
            {legendItems.map((item) => (
              <span key={item.type} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ background: nodeColors[item.type] }}
                />
                {item.label}
              </span>
            ))}
          </div>
          <button
            className={styles.graphModalClose}
            onClick={onClose}
            title="关闭 (Esc)"
          >
            ✕
          </button>
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

  const fgNodes = graphData
    ? graphData.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type }))
    : [];
  const fgLinks = graphData
    ? graphData.edges.map((e) => ({ source: e.source, target: e.target, label: e.label }))
    : [];

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
            {graphData.nodes.length} 节点 · {graphData.edges.length} 边
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
          <div className={styles.graphLegend}>
            {legendItems.map((item) => (
              <span key={item.type} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ background: nodeColors[item.type] }}
                />
                {item.label}
              </span>
            ))}
          </div>
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
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </div>
  );
}
