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

const MOCK_GRAPH: GraphData = {
  nodes: [
    { id: 'n1', label: '信息安全策略', type: 'entity' },
    { id: 'n2', label: '数据分类', type: 'concept' },
    { id: 'n3', label: '访问控制', type: 'concept' },
    { id: 'n4', label: '安全等级', type: 'rule' },
    { id: 'n5', label: '网络安全', type: 'entity' },
    { id: 'n6', label: '审计日志', type: 'concept' },
    { id: 'n7', label: '物理安全', type: 'entity' },
    { id: 'n8', label: '安全事件', type: 'entity' },
    { id: 'n9', label: '合规审计', type: 'concept' },
    { id: 'n10', label: '员工培训', type: 'concept' },
  ],
  edges: [
    { source: 'n1', target: 'n2', label: '管辖' },
    { source: 'n1', target: 'n3', label: '包含' },
    { source: 'n2', target: 'n4', label: '定义' },
    { source: 'n3', target: 'n6', label: '记录' },
    { source: 'n1', target: 'n5', label: '覆盖' },
    { source: 'n4', target: 'n5', label: '约束' },
    { source: 'n1', target: 'n7', label: '覆盖' },
    { source: 'n8', target: 'n6', label: '触发' },
    { source: 'n9', target: 'n1', label: '审查' },
    { source: 'n10', target: 'n3', label: '执行' },
  ],
};

export class GraphService {
  async getGraphData(_taskId: string): Promise<GraphData | null> {
    return MOCK_GRAPH;
  }
}
