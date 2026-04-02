import { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useResultStore } from '../../store/resultStore';
import styles from './RightPanel.module.css';

const nodeColors: Record<string, string> = {
  entity: '#3b82f6',
  concept: '#22c55e',
  rule: '#a855f7',
};

const nodeBg: Record<string, string> = {
  entity: 'rgba(59,130,246,0.12)',
  concept: 'rgba(34,197,94,0.12)',
  rule: 'rgba(168,85,247,0.12)',
};

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
      const fontSize = 11;
      ctx.font = `${fontSize}px -apple-system, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const padding = 8;
      const w = textWidth + padding * 2;
      const h = fontSize + padding * 1.5;
      const x = node.x! - w / 2;
      const y = node.y! - h / 2;

      ctx.fillStyle = nodeBg[type] ?? nodeBg.entity;
      ctx.strokeStyle = nodeColors[type] ?? nodeColors.entity;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = nodeColors[type] ?? nodeColors.entity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, node.x!, node.y!);
    },
    []
  );

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      const start = link.source;
      const end = link.target;
      if (typeof start !== 'object' || typeof end !== 'object') return;

      ctx.strokeStyle = 'rgba(99,102,241,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      ctx.fillStyle = 'rgba(99,102,241,0.6)';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(link.label ?? '', mx, my - 2);
    },
    []
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
          <div ref={containerRef} className={styles.graphContainer}>
            <ForceGraph2D
              graphData={fgData}
              width={dims.width}
              height={dims.height}
              nodeCanvasObject={nodeCanvasObject}
              linkCanvasObject={linkCanvasObject}
              nodePointerAreaPaint={(node: any, color, ctx) => {
                const label = node.label as string;
                ctx.font = '11px -apple-system, sans-serif';
                const tw = ctx.measureText(label).width;
                const w = tw + 16;
                const h = 23;
                ctx.fillStyle = color;
                ctx.fillRect(node.x! - w / 2, node.y! - h / 2, w, h);
              }}
              cooldownTicks={60}
              d3AlphaDecay={0.05}
              d3VelocityDecay={0.3}
              backgroundColor="transparent"
            />
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 0' }}>
        <p className={styles.graphHint}>
          图谱将在 Step 5 完成后更新完整版本。当前展示基于本体提取结果生成的预览。
        </p>
        <button className={styles.graphBtn}>🔗 在图数据库中查看完整图谱 →</button>
      </div>
    </div>
  );
}
