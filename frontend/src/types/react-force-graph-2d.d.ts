declare module 'react-force-graph-2d' {
  import type { ComponentType } from 'react';

  interface ForceGraphProps {
    graphData: {
      nodes: any[];
      links: any[];
    };
    width?: number;
    height?: number;
    backgroundColor?: string;
    nodeCanvasObject?: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    linkCanvasObject?: (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    nodePointerAreaPaint?: (node: any, color: string, ctx: CanvasRenderingContext2D) => void;
    cooldownTicks?: number;
    d3AlphaDecay?: number;
    d3VelocityDecay?: number;
    onNodeClick?: (node: any) => void;
    [key: string]: any;
  }

  const ForceGraph2D: ComponentType<ForceGraphProps>;
  export default ForceGraph2D;
}
