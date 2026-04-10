import { useState } from 'react';
import { AGENT_REGISTRY } from '../../constants/agentRegistry';
import type { AgentInfo } from '../../constants/agentRegistry';
import styles from './AgentFlow.module.css';

function AgentNode({ agent, isExpanded, onToggle }: {
  agent: AgentInfo;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isManager = agent.role === 'manager';

  return (
    <div
      className={`${styles.node} ${isManager ? styles.nodeManager : styles.nodeWorker}`}
      onClick={onToggle}
    >
      <div className={styles.nodeHeader}>
        <span className={`${styles.roleTag} ${isManager ? styles.roleManager : styles.roleWorker}`}>
          {isManager ? 'Lead' : 'Worker'}
        </span>
        <span className={styles.statusDot} />
      </div>
      <div className={styles.nodeName}>{agent.name}</div>
      <div className={styles.nodeId}>{agent.id}</div>
      <div className={styles.nodeSkillCount}>
        {agent.skills.length} skills
      </div>

      {isExpanded && (
        <div className={styles.nodeDetail}>
          <div className={styles.detailDesc}>{agent.description}</div>
          <div className={styles.detailModel}>
            <span className={styles.detailLabel}>Model</span>
            <span className={styles.detailValue}>{agent.model}</span>
          </div>
          <div className={styles.detailSkills}>
            {agent.skills.map((s) => (
              <span key={s} className={styles.skillChip}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentFlow() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const manager = AGENT_REGISTRY.find((a) => a.role === 'manager')!;
  const workers = AGENT_REGISTRY.filter((a) => a.role === 'worker');

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className={styles.flow}>
      <div className={styles.sectionTitle}>Agent 编排架构</div>

      <div className={styles.managerRow}>
        <AgentNode
          agent={manager}
          isExpanded={expandedId === manager.id}
          onToggle={() => toggle(manager.id)}
        />
      </div>

      <div className={styles.connectorGroup}>
        <div className={styles.vertLine} />
        <div className={styles.horizLine} />
        {workers.map((_, i) => (
          <div
            key={i}
            className={styles.branchLine}
            style={{ left: `${(100 / (workers.length + 1)) * (i + 1)}%` }}
          />
        ))}
      </div>

      <div className={styles.workerRow}>
        {workers.map((w) => (
          <AgentNode
            key={w.id}
            agent={w}
            isExpanded={expandedId === w.id}
            onToggle={() => toggle(w.id)}
          />
        ))}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendManager}`} />
          Manager
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendWorker}`} />
          Worker
        </span>
        <span className={styles.legendHint}>
          点击节点查看详情
        </span>
      </div>
    </div>
  );
}
