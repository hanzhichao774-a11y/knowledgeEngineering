import { useCallback, useRef } from 'react';
import { useTaskStore } from '../store/taskStore';
import { useChatStore } from '../store/chatStore';
import { useResultStore } from '../store/resultStore';
import type { Task, ChatMessage, OntologyResult, GraphData, AgentDetail } from '../types';

const MOCK_TASK: Task = {
  id: 'task-1',
  title: '企业信息安全管理制度.pdf',
  icon: '📄',
  status: 'running',
  createdAt: '2 分钟前',
  steps: [
    { name: '文档解析', status: 'pending', skill: '多模态文档解析', skillIcon: '📑', tokenUsed: 0, tokenLimit: 8000 },
    { name: '本体提取', status: 'pending', skill: '本体提取', skillIcon: '🔍', tokenUsed: 0, tokenLimit: 8000 },
    { name: 'Schema 构建', status: 'pending', skill: 'Schema 构建', skillIcon: '📊', tokenUsed: 0, tokenLimit: 8000 },
    { name: '写入图数据库', status: 'pending', skill: '图数据库写入', skillIcon: '💾', tokenUsed: 0, tokenLimit: 8000 },
    { name: '生成知识图谱', status: 'pending', skill: '知识图谱生成', skillIcon: '🕸️', tokenUsed: 0, tokenLimit: 8000 },
  ],
  cost: { inputTokens: 0, outputTokens: 0, estimatedCost: 0, elapsed: '0s' },
};

const MOCK_TASKS_EXTRA: Task[] = [
  {
    id: 'task-2',
    title: '数据分类分级标准.docx',
    icon: '📄',
    status: 'completed',
    createdAt: '15 分钟前',
    steps: [
      { name: '文档解析', status: 'done', skill: '多模态文档解析', skillIcon: '📑', tokenUsed: 980, tokenLimit: 8000, duration: 2.8 },
      { name: '本体提取', status: 'done', skill: '本体提取', skillIcon: '🔍', tokenUsed: 3200, tokenLimit: 8000, duration: 7.2 },
      { name: 'Schema 构建', status: 'done', skill: 'Schema 构建', skillIcon: '📊', tokenUsed: 2100, tokenLimit: 8000, duration: 5.1 },
      { name: '写入图数据库', status: 'done', skill: '图数据库写入', skillIcon: '💾', tokenUsed: 450, tokenLimit: 8000, duration: 1.2 },
      { name: '生成知识图谱', status: 'done', skill: '知识图谱生成', skillIcon: '🕸️', tokenUsed: 680, tokenLimit: 8000, duration: 2.0 },
    ],
    cost: { inputTokens: 4800, outputTokens: 2610, estimatedCost: 0.38, elapsed: '1m 05s' },
  },
  {
    id: 'task-3',
    title: '员工入职流程规范.pdf',
    icon: '📄',
    status: 'queued',
    createdAt: '1 分钟前',
    steps: [
      { name: '文档解析', status: 'pending', skill: '多模态文档解析', skillIcon: '📑', tokenUsed: 0, tokenLimit: 8000 },
      { name: '本体提取', status: 'pending', skill: '本体提取', skillIcon: '🔍', tokenUsed: 0, tokenLimit: 8000 },
      { name: 'Schema 构建', status: 'pending', skill: 'Schema 构建', skillIcon: '📊', tokenUsed: 0, tokenLimit: 8000 },
      { name: '写入图数据库', status: 'pending', skill: '图数据库写入', skillIcon: '💾', tokenUsed: 0, tokenLimit: 8000 },
      { name: '生成知识图谱', status: 'pending', skill: '知识图谱生成', skillIcon: '🕸️', tokenUsed: 0, tokenLimit: 8000 },
    ],
    cost: { inputTokens: 0, outputTokens: 0, estimatedCost: 0, elapsed: '0s' },
  },
];

const MOCK_ONTOLOGY: OntologyResult = {
  entities: [
    { name: '信息安全策略', type: 'entity', desc: '组织信息安全总体方针' },
    { name: '安全等级', type: 'attr', desc: '机密/秘密/内部/公开' },
    { name: '数据分类', type: 'entity', desc: '按敏感程度划分数据类别' },
    { name: '访问控制', type: 'entity', desc: '用户权限管理机制' },
    { name: '管辖', type: 'relation', desc: '安全策略 → 数据分类' },
    { name: '约束', type: 'relation', desc: '访问控制 → 安全等级' },
    { name: '网络安全', type: 'entity', desc: '网络边界防护与入侵检测' },
    { name: '物理安全', type: 'entity', desc: '机房与设备物理防护' },
    { name: '安全事件', type: 'entity', desc: '安全事件记录与响应' },
    { name: '审计日志', type: 'entity', desc: '操作行为审计追溯' },
    { name: '合规审计', type: 'entity', desc: '定期合规检查机制' },
    { name: '覆盖', type: 'relation', desc: '安全策略 → 网络安全' },
  ],
  entityCount: 18,
  relationCount: 12,
  ruleCount: 9,
  attrCount: 25,
};

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

const SCHEMA_PARTIAL = `<span style="color:#a855f7">@prefix</span> biz: &lt;http://bizagentos.ai/ontology/&gt; .<br>
<span style="color:#a855f7">@prefix</span> rdfs: &lt;http://www.w3.org/2000/01/rdf-schema#&gt; .<br>
<br>
biz:<span style="color:#3b82f6">SecurityPolicy</span> a rdfs:Class ;<br>
&nbsp;&nbsp;rdfs:label <span style="color:#22c55e">"信息安全策略"</span> ;<br>
&nbsp;&nbsp;biz:level [<span style="color:#eab308"> "机密", "秘密", "内部", "公开" </span>] .<br>
<br>
biz:<span style="color:#3b82f6">DataClassification</span> a rdfs:Class ;<br>
&nbsp;&nbsp;rdfs:label <span style="color:#22c55e">"数据分类"</span> .`;

const SCHEMA_FULL = `${SCHEMA_PARTIAL}<br>
<br>
biz:<span style="color:#3b82f6">AccessControl</span> a rdfs:Class ;<br>
&nbsp;&nbsp;rdfs:label <span style="color:#22c55e">"访问控制"</span> ;<br>
&nbsp;&nbsp;biz:model <span style="color:#22c55e">"RBAC"</span> .<br>
<br>
biz:<span style="color:#3b82f6">NetworkSecurity</span> a rdfs:Class ;<br>
&nbsp;&nbsp;rdfs:label <span style="color:#22c55e">"网络安全"</span> .<br>
<br>
biz:<span style="color:#f97316">governs</span> a rdf:Property ;<br>
&nbsp;&nbsp;rdfs:domain biz:SecurityPolicy ;<br>
&nbsp;&nbsp;rdfs:range biz:DataClassification .`;

function buildAgentDetail(currentStep: number, inputTokens: number, outputTokens: number, elapsed: string): AgentDetail {
  const skillStatuses: Array<'done' | 'running' | 'idle'> = [
    currentStep > 1 ? 'done' : currentStep === 1 ? 'running' : 'idle',
    currentStep > 2 ? 'done' : currentStep === 2 ? 'running' : 'idle',
    currentStep > 3 ? 'done' : currentStep === 3 ? 'running' : 'idle',
    currentStep > 4 ? 'done' : currentStep === 4 ? 'running' : 'idle',
    currentStep > 5 ? 'done' : currentStep === 5 ? 'running' : 'idle',
  ];
  return {
    id: 'KE-01',
    name: '知识工程数字员工 #KE-01',
    description: '知识工程工作线 · 实例 01',
    inputTokens,
    outputTokens,
    elapsed,
    currentStep: Math.min(currentStep, 5),
    totalSteps: 5,
    skills: [
      { name: '多模态文档解析', icon: '📑', status: skillStatuses[0] },
      { name: '本体提取', icon: '🔍', status: skillStatuses[1] },
      { name: 'Schema 构建', icon: '📊', status: skillStatuses[2] },
      { name: '图数据库写入', icon: '💾', status: skillStatuses[3] },
      { name: '知识图谱生成', icon: '🕸️', status: skillStatuses[4] },
    ],
  };
}

export function useMockFlow() {
  const started = useRef(false);

  const initialize = useCallback(() => {
    if (started.current) return;
    started.current = true;

    const taskStore = useTaskStore.getState();
    const chatStore = useChatStore.getState();
    const resultStore = useResultStore.getState();

    taskStore.addTask({ ...MOCK_TASK });
    MOCK_TASKS_EXTRA.forEach((t) => taskStore.addTask({ ...t }));
    taskStore.setActiveTask('task-1');

    const addMsg = (msg: Omit<ChatMessage, 'id'>, delay: number) =>
      setTimeout(() => {
        chatStore.addMessage({ ...msg, id: `msg-${Date.now()}-${Math.random()}` });
      }, delay);

    const updateStep = (idx: number, updates: Partial<Task['steps'][0]>, delay: number) =>
      setTimeout(() => {
        taskStore.updateStep('task-1', idx, updates);
      }, delay);

    const updateCost = (cost: Task['cost'], delay: number) =>
      setTimeout(() => {
        taskStore.updateCost('task-1', cost);
      }, delay);

    // User message
    addMsg({
      role: 'user',
      name: '张闯',
      content: '<p>请帮我处理这份企业信息安全管理制度文档，提取其中的关键概念、规则和关系，构建知识图谱。</p>',
      timestamp: '14:32',
      attachment: { name: '企业信息安全管理制度.pdf', size: '2.4 MB', pages: 38 },
    }, 300);

    // Manager response
    addMsg({
      role: 'manager',
      name: '管理智能体',
      content: `<p>收到任务。已分析文档类型为 <strong>企业制度文本（PDF）</strong>，属于知识工程工作线范围。</p>
<p>正在进行 Skill 覆盖检查...</p>
<p>✅ 知识工程数字员工 <strong>#KE-01</strong> 具备所需能力：</p>
<p>• 文档解析（多模态） · 本体提取 · Schema 构建 · 图数据库写入</p>
<p>📋 <strong>任务已委派</strong> → 知识工程数字员工 #KE-01</p>`,
      timestamp: '14:32',
    }, 1500);

    // Step 1: Document parsing
    updateStep(0, { status: 'running' }, 2500);
    updateCost({ inputTokens: 320, outputTokens: 0, estimatedCost: 0.02, elapsed: '3s' }, 2500);

    setTimeout(() => {
      resultStore.setAgentDetail(buildAgentDetail(1, 320, 0, '3s'));
    }, 2500);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 1/5 · 文档解析</strong></p><p>正在解析 PDF 文档...</p>',
      timestamp: '14:32',
      agentStatus: { skill: '多模态文档解析', skillIcon: '📑', tokenUsed: 600, tokenLimit: 8000, status: 'running' },
    }, 3000);

    updateStep(0, { status: 'done', tokenUsed: 1247, duration: 3.2 }, 5500);
    updateCost({ inputTokens: 1247, outputTokens: 420, estimatedCost: 0.08, elapsed: '6s' }, 5500);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 1/5 · 文档解析</strong></p><p>已识别 38 页内容，提取 7 个章节、42 个段落、15 张表格。</p>',
      timestamp: '14:32',
      agentStatus: { skill: '多模态文档解析', skillIcon: '📑', tokenUsed: 1247, tokenLimit: 8000, status: 'done', duration: 3.2 },
    }, 5500);

    setTimeout(() => {
      resultStore.setDocumentSummary(
        '本文档为企业信息安全管理制度，共 7 章 38 页，涵盖：信息安全策略、数据分类分级、访问控制、网络安全、物理安全、安全事件管理、合规审计。核心规定了四级安全等级体系和基于角色的访问控制模型。'
      );
      resultStore.setAgentDetail(buildAgentDetail(1, 1247, 420, '6s'));
    }, 5500);

    // Step 2: Ontology extraction
    updateStep(1, { status: 'running' }, 6500);
    updateCost({ inputTokens: 2400, outputTokens: 800, estimatedCost: 0.16, elapsed: '15s' }, 6500);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 2/5 · 本体提取</strong></p><p>正在从文档中提取概念、术语、规则和关系...</p>',
      timestamp: '14:33',
      agentStatus: { skill: '本体提取', skillIcon: '🔍', tokenUsed: 1800, tokenLimit: 8000, status: 'running' },
    }, 7000);

    setTimeout(() => {
      resultStore.setAgentDetail(buildAgentDetail(2, 2400, 800, '15s'));
    }, 7000);

    updateStep(1, { status: 'done', tokenUsed: 3891, duration: 8.5 }, 11000);
    updateCost({ inputTokens: 3891, outputTokens: 1600, estimatedCost: 0.28, elapsed: '28s' }, 11000);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 2/5 · 本体提取</strong></p><p>已提取 <strong>18 个实体</strong>、<strong>12 条关系</strong>、<strong>9 条规则</strong>、<strong>25 个属性</strong>。</p>',
      timestamp: '14:33',
      agentStatus: { skill: '本体提取', skillIcon: '🔍', tokenUsed: 3891, tokenLimit: 8000, status: 'done', duration: 8.5 },
    }, 11000);

    setTimeout(() => {
      resultStore.setOntologyResult(MOCK_ONTOLOGY);
      resultStore.setAgentDetail(buildAgentDetail(2, 3891, 1600, '28s'));
    }, 11000);

    // Step 3: Schema building
    updateStep(2, { status: 'running' }, 12500);
    updateCost({ inputTokens: 4500, outputTokens: 2000, estimatedCost: 0.33, elapsed: '40s' }, 12500);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 3/5 · Schema 构建</strong></p><p>基于提取结果构建结构化 Schema...</p>',
      timestamp: '14:33',
      agentStatus: { skill: 'Schema 构建', skillIcon: '📊', tokenUsed: 4500, tokenLimit: 8000, status: 'running' },
      thinking: '正在构建实体关系 Schema...',
    }, 13000);

    setTimeout(() => {
      resultStore.setSchemaContent(SCHEMA_PARTIAL + '<br><br><span style="color:var(--text-muted)">// 构建中... 已完成 60%</span>');
      resultStore.setSchemaStatus('building');
      resultStore.setSchemaProgress(60);
      resultStore.setAgentDetail(buildAgentDetail(3, 4500, 2000, '40s'));
    }, 13000);

    updateStep(2, { status: 'done', tokenUsed: 5138, duration: 6.3 }, 17000);
    updateCost({ inputTokens: 5138, outputTokens: 2764, estimatedCost: 0.42, elapsed: '55s' }, 17000);

    setTimeout(() => {
      resultStore.setSchemaContent(SCHEMA_FULL);
      resultStore.setSchemaStatus('done');
      resultStore.setSchemaProgress(100);
      resultStore.setAgentDetail(buildAgentDetail(3, 5138, 2764, '55s'));
    }, 17000);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 3/5 · Schema 构建</strong></p><p>Schema 构建完成。已生成 7 个 Class、5 个 Property、4 条约束规则。</p>',
      timestamp: '14:34',
      agentStatus: { skill: 'Schema 构建', skillIcon: '📊', tokenUsed: 5138, tokenLimit: 8000, status: 'done', duration: 6.3 },
    }, 17500);

    // Step 4: Graph DB write
    updateStep(3, { status: 'running' }, 18500);
    updateCost({ inputTokens: 5500, outputTokens: 2900, estimatedCost: 0.45, elapsed: '1m 05s' }, 18500);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 4/5 · 写入图数据库</strong></p><p>正在将本体和 Schema 写入 Neo4j 图数据库...</p>',
      timestamp: '14:34',
      agentStatus: { skill: '图数据库写入', skillIcon: '💾', tokenUsed: 5500, tokenLimit: 8000, status: 'running' },
    }, 19000);

    setTimeout(() => {
      resultStore.setAgentDetail(buildAgentDetail(4, 5500, 2900, '1m 05s'));
    }, 19000);

    updateStep(3, { status: 'done', tokenUsed: 5800, duration: 2.1 }, 21500);
    updateCost({ inputTokens: 5800, outputTokens: 3100, estimatedCost: 0.48, elapsed: '1m 15s' }, 21500);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 4/5 · 写入图数据库</strong></p><p>成功写入 18 个节点、12 条边到 Neo4j。</p>',
      timestamp: '14:34',
      agentStatus: { skill: '图数据库写入', skillIcon: '💾', tokenUsed: 5800, tokenLimit: 8000, status: 'done', duration: 2.1 },
    }, 21500);

    // Step 5: Knowledge graph generation
    updateStep(4, { status: 'running' }, 22500);
    updateCost({ inputTokens: 6200, outputTokens: 3300, estimatedCost: 0.51, elapsed: '1m 20s' }, 22500);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 5/5 · 生成知识图谱</strong></p><p>正在生成可视化知识图谱...</p>',
      timestamp: '14:35',
      agentStatus: { skill: '知识图谱生成', skillIcon: '🕸️', tokenUsed: 6200, tokenLimit: 8000, status: 'running' },
    }, 23000);

    setTimeout(() => {
      resultStore.setAgentDetail(buildAgentDetail(5, 6200, 3300, '1m 20s'));
    }, 23000);

    updateStep(4, { status: 'done', tokenUsed: 6580, duration: 3.5 }, 26000);
    updateCost({ inputTokens: 6580, outputTokens: 3580, estimatedCost: 0.55, elapsed: '1m 28s' }, 26000);

    addMsg({
      role: 'worker',
      name: '知识工程 #KE-01',
      content: '<p><strong>Step 5/5 · 生成知识图谱</strong></p><p>✅ 知识图谱生成完成！包含 10 个节点、10 条边。</p>',
      timestamp: '14:35',
      agentStatus: { skill: '知识图谱生成', skillIcon: '🕸️', tokenUsed: 6580, tokenLimit: 8000, status: 'done', duration: 3.5 },
    }, 26000);

    setTimeout(() => {
      resultStore.setGraphData(MOCK_GRAPH);
      resultStore.setAgentDetail(buildAgentDetail(5, 6580, 3580, '1m 28s'));
      taskStore.updateTaskStatus('task-1', 'completed');
    }, 26000);

    // Final manager message
    addMsg({
      role: 'manager',
      name: '管理智能体',
      content: `<p>✅ <strong>知识工程任务已完成</strong></p>
<p>知识工程数字员工 #KE-01 已完成全部 5 个步骤：</p>
<p>• 文档解析 → 本体提取 → Schema 构建 → 图数据库写入 → 知识图谱生成</p>
<p>📊 产出：18 个实体、12 条关系、9 条规则、结构化 Schema、知识图谱</p>
<p>💰 总消耗：输入 6,580 Token · 输出 3,580 Token · 预估费用 ¥0.55</p>
<p>您可以在右侧面板查看详细结果，或切换到「图谱」Tab 查看可视化知识图谱。</p>`,
      timestamp: '14:35',
    }, 27500);
  }, []);

  return { initialize };
}
