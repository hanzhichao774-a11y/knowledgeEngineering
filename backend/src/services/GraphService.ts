import { TaskService } from './TaskService.js';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const graphStore = new Map<string, GraphData>();

export function storeGraphData(taskId: string, data: GraphData) {
  graphStore.set(taskId, data);
}

export class GraphService {
  async getGraphData(taskId: string): Promise<GraphData | null> {
    return graphStore.get(taskId) ?? null;
  }
}
