import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useResultStore } from '../../store/resultStore';
import { AgentFlow } from './AgentFlow';
import styles from './RightPanel.module.css';

const skillStatusLabels: Record<string, { text: string; color: string }> = {
  active: { text: '使用中', color: 'var(--green)' },
  running: { text: '执行中', color: 'var(--yellow)' },
  done: { text: '已完成', color: 'var(--text-muted)' },
  idle: { text: '待执行', color: 'var(--text-muted)' },
};

function RuntimeMonitor() {
  const agentDetail = useResultStore((s) => s.agentDetail);
  const [collapsed, setCollapsed] = useState(false);

  if (!agentDetail) return null;

  return (
    <div className={styles.runtimeSection}>
      <button
        className={styles.runtimeToggle}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className={styles.runtimeDot} />
        <span className={styles.runtimeLabel}>实时监控</span>
        {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {!collapsed && (
        <div className={styles.runtimeBody}>
          <div className={styles.agentDetail}>
            <div className={styles.agentHeader}>
              <div className={styles.agentAvatarLg}>📝</div>
              <div className={styles.agentInfo}>
                <h3 className={styles.agentName}>{agentDetail.name}</h3>
                <p className={styles.agentDesc}>{agentDetail.description}</p>
              </div>
            </div>
            <div className={styles.metricGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>输入 Token</div>
                <div className={`${styles.metricValue} ${styles.metricBlue}`}>
                  {agentDetail.inputTokens.toLocaleString()}
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>输出 Token</div>
                <div className={`${styles.metricValue} ${styles.metricPurple}`}>
                  {agentDetail.outputTokens.toLocaleString()}
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>执行耗时</div>
                <div className={`${styles.metricValue} ${styles.metricYellow}`}>
                  {agentDetail.elapsed}
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>当前步骤</div>
                <div className={`${styles.metricValue} ${styles.metricGreen}`}>
                  {agentDetail.currentStep} / {agentDetail.totalSteps}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.resultCard} style={{ marginTop: 10 }}>
            <div className={styles.resultCardHeader}>
              <span className={styles.resultIcon}>🛠️</span>
              <span className={styles.resultTitle}>已挂载 Skills</span>
            </div>
            <div className={styles.resultCardBody}>
              {agentDetail.skills.map((skill, i) => {
                const st = skillStatusLabels[skill.status] ?? skillStatusLabels.idle;
                return (
                  <div key={i} className={styles.skillListItem}>
                    <span
                      className={styles.skillDot}
                      style={{
                        background:
                          skill.status === 'idle' ? 'var(--text-muted)' : 'var(--green)',
                      }}
                    />
                    <span>
                      {skill.icon} {skill.name}
                    </span>
                    <span className={styles.skillStatus} style={{ color: st.color }}>
                      {st.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentTab() {
  return (
    <div>
      <AgentFlow />
      <RuntimeMonitor />
    </div>
  );
}
