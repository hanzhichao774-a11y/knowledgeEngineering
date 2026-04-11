import { useEffect, useState } from 'react';
import { AGENT_REGISTRY, SKILL_CATALOG, SKILL_CATEGORIES } from '../../constants/agentRegistry';
import { fetchKnowledgeStatus, fetchGlobalGraph } from '../../services/api';
import styles from './DashboardView.module.css';

interface KbStatus {
  connected: boolean;
  nodeCount: number;
  edgeCount: number;
}

const categoryOrder = ['pipeline', 'query', 'system'] as const;

export function DashboardView() {
  const [kb, setKb] = useState<KbStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [status, graph] = await Promise.allSettled([
          fetchKnowledgeStatus(),
          fetchGlobalGraph(),
        ]);

        if (cancelled) return;

        const connected = status.status === 'fulfilled' && status.value.connected;
        let nodeCount = 0;
        let edgeCount = 0;

        if (status.status === 'fulfilled') {
          nodeCount = status.value.nodeCount ?? 0;
          edgeCount = status.value.edgeCount ?? 0;
        }
        if (graph.status === 'fulfilled' && graph.value) {
          const g = graph.value;
          if (g.nodes) nodeCount = Math.max(nodeCount, g.nodes.length);
          if (g.links || g.edges) edgeCount = Math.max(edgeCount, (g.links ?? g.edges ?? []).length);
        }

        setKb({ connected, nodeCount, edgeCount });
      } catch {
        if (!cancelled) setKb({ connected: false, nodeCount: 0, edgeCount: 0 });
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const grouped = categoryOrder.map((cat) => ({
    category: cat,
    ...SKILL_CATEGORIES[cat],
    skills: SKILL_CATALOG.filter((s) => s.category === cat),
  }));

  return (
    <div className={styles.dashboard}>
      {/* Agents */}
      <section>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>🤖</span> 智能体
        </h3>
        <div className={styles.agentGrid}>
          {AGENT_REGISTRY.map((agent) => (
            <div key={agent.id} className={styles.agentCard}>
              <div className={styles.agentCardHeader}>
                <div
                  className={`${styles.agentAvatar} ${
                    agent.role === 'manager' ? styles.avatarManager : styles.avatarWorker
                  }`}
                >
                  {agent.role === 'manager' ? '🧠' : '⚙️'}
                </div>
                <div>
                  <div className={styles.agentName}>{agent.name}</div>
                  <div className={styles.agentRole}>
                    {agent.role === 'manager' ? '管理者' : '执行者'} · {agent.model}
                  </div>
                </div>
              </div>
              <div className={styles.agentDesc}>{agent.description}</div>
              <div className={styles.agentMeta}>
                <span className={styles.metaItem}>🛠 {agent.skills.length} 项技能</span>
                {agent.children.length > 0 && (
                  <span className={styles.metaItem}>👥 {agent.children.length} 个下属</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section className={styles.skillSection}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>🛠</span> 全局技能（{SKILL_CATALOG.length}）
        </h3>
        {grouped.map((g) => (
          <div key={g.category} className={styles.skillCategoryRow}>
            <span
              className={styles.skillCategoryLabel}
              style={{ color: g.color, background: g.bg }}
            >
              {g.label}（{g.skills.length}）
            </span>
            <div className={styles.skillGrid}>
              {g.skills.map((s) => (
                <span key={s.id} className={styles.skillChip} title={s.desc}>
                  <span className={styles.skillIcon}>{s.icon}</span>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Knowledge Base */}
      <section>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>📚</span> 知识库
        </h3>
        <div className={styles.kbCard}>
          {kb === null ? (
            <div className={styles.kbDisconnected}>加载中...</div>
          ) : kb.connected ? (
            <>
              <div className={styles.kbStats}>
                <div className={styles.kbStat}>
                  <span className={styles.kbStatValue}>{kb.nodeCount}</span>
                  <span className={styles.kbStatLabel}>
                    <span className={`${styles.statusDot} ${styles.dotGreen}`} />
                    知识节点
                  </span>
                </div>
                <div className={styles.kbStat}>
                  <span className={styles.kbStatValue}>{kb.edgeCount}</span>
                  <span className={styles.kbStatLabel}>关系连边</span>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.kbDisconnected}>
              <span className={`${styles.statusDot} ${styles.dotRed}`} />
              知识库未连接 — 上传文档并执行任务后自动构建
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
