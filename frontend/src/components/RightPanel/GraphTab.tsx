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

export function GraphTab() {
  const graphData = useResultStore((s) => s.graphData);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 340, height: 260 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({
          width: entry.contentRect.width || 340,
          height: entry.contentRect.height || 260,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fgData = graphData
    ? {
        nodes: graphData.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type })),
        links: graphData.edges.map((e) => ({
          source: e.source,
          target: e.target,
          label: e.label,
        })),
      }
    : { nodes: [], links: [] };

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D) => {
      const label = node.label as string;
      const type = (node.type as string) || 'entity';
      const isClass = type === 'class';
      const fontSize = isClass ? 12 : 11;
      ctx.font = `${isClass ? 'bold ' : ''}${fontSize}px -apple-system, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const padding = isClass ? 10 : 8;
      const w = textWidth + padding * 2;
      const h = fontSize + padding * 1.5;
      const x = node.x! - w / 2;
      const y = node.y! - h / 2;

      ctx.fillStyle = nodeBg[type] ?? nodeBg.entity;
      ctx.strokeStyle = nodeColors[type] ?? nodeColors.entity;
      ctx.lineWidth = isClass ? 2 : 1;
      ctx.beginPath();
      if (isClass) {
        const cx = node.x!;
        const cy = node.y!;
        const rx = w / 2;
        const ry = h / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else {
        ctx.roundRect(x, y, w, h, 4);
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

      const arrowLen = 6;
      const arrowX = end.x - ux * 12;
      const arrowY = end.y - uy * 12;
      ctx.fillStyle = 'rgba(148,163,184,0.7)';
      ctx.beginPath();
      ctx.moveTo(arrowX + ux * arrowLen, arrowY + uy * arrowLen);
      ctx.lineTo(arrowX - uy * 3, arrowY + ux * 3);
      ctx.lineTo(arrowX + uy * 3, arrowY - ux * 3);
      ctx.closePath();
      ctx.fill();

      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const labelText = link.label ?? '';
      if (labelText) {
        ctx.font = '9px -apple-system, sans-serif';
        const tw = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(15,23,42,0.75)';
        ctx.fillRect(mx - tw / 2 - 3, my - 7, tw + 6, 12);
        ctx.fillStyle = 'rgba(226,232,240,0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, mx, my);
      }
    },
    [],
  );

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
            <ForceGraph2D
              graphData={fgData}
              width={dims.width}
              height={dims.height}
              nodeCanvasObject={nodeCanvasObject}
              linkCanvasObject={linkCanvasObject}
              linkDirectionalArrowLength={0}
              nodePointerAreaPaint={(node: any, color, ctx) => {
                const label = node.label as string;
                ctx.font = '11px -apple-system, sans-serif';
                const tw = ctx.measureText(label).width;
                const w = tw + 20;
                const h = 26;
                ctx.fillStyle = color;
                ctx.fillRect(node.x! - w / 2, node.y! - h / 2, w, h);
              }}
              cooldownTicks={80}
              d3AlphaDecay={0.04}
              d3VelocityDecay={0.25}
              backgroundColor="transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
