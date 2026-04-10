import type { ChatMessage } from '../../types';
import { ReportCard } from './ReportCard';
import styles from './CenterPanel.module.css';

interface AgentNodeProps {
  msg: ChatMessage;
  children?: ChatMessage[];
  isRunning?: boolean;
}

export function AgentNode({ msg, children, isRunning }: AgentNodeProps) {
  const isManager = msg.role === 'manager';

  return (
    <div className={styles.agentTree}>
      <div className={styles.agentNode}>
        <div className={styles.agentNodeMeta}>
          <div className={`${styles.agentAvatar} ${isManager ? styles.avatarMaster : styles.avatarChild}`}>
            {isManager ? '🧠' : '📝'}
          </div>
          <span className={styles.agentNodeName}>{msg.name}</span>
          {!isManager && (
            <span className={styles.agentNodeRole}>数字员工</span>
          )}
        </div>
        <div className={styles.agentBubble} dangerouslySetInnerHTML={{ __html: msg.content }} />

        {msg.report && <ReportCard report={msg.report} />}

        {children && children.length > 0 && (
          <div className={styles.children}>
            {children.map((child) => (
              <div key={child.id} className={styles.childItem}>
                <div className={styles.agentNode}>
                  <div className={styles.agentNodeMeta}>
                    <div className={`${styles.agentAvatar} ${styles.avatarChild}`}>
                      📝
                    </div>
                    <span className={styles.agentNodeName}>{child.name}</span>
                    <span className={styles.agentNodeRole}>数字员工</span>
                  </div>
                  <div className={styles.agentBubble} dangerouslySetInnerHTML={{ __html: child.content }} />
                  {child.agentStatus && (
                    <div className={styles.agentStatusCard}>
                      <div className={styles.agentStatusRow}>
                        <span className={styles.agentStatusLabel}>Skill</span>
                        <span className={styles.skillTag}>
                          {child.agentStatus.skillIcon} {child.agentStatus.skill}
                        </span>
                      </div>
                      <div className={styles.agentStatusRow}>
                        <span className={styles.agentStatusLabel}>状态</span>
                        {child.agentStatus.status === 'done' ? (
                          <span className={styles.statusDone}>
                            ✅ 完成{child.agentStatus.duration != null ? ` · ${child.agentStatus.duration}s` : ''}
                          </span>
                        ) : child.agentStatus.status === 'running' ? (
                          <span className={styles.statusRunning}>⟳ 执行中...</span>
                        ) : (
                          <span className={styles.statusError}>❌ 错误</span>
                        )}
                      </div>
                    </div>
                  )}
                  {child.report && <ReportCard report={child.report} />}
                </div>
              </div>
            ))}
            {isRunning && (
              <div className={styles.childItem}>
                <div className={styles.pulseIndicator}>
                  <span className={styles.pulseDot} />
                  处理中...
                </div>
              </div>
            )}
          </div>
        )}

        {isRunning && (!children || children.length === 0) && (
          <div className={styles.children}>
            <div className={styles.childItem}>
              <div className={styles.pulseIndicator}>
                <span className={styles.pulseDot} />
                处理中...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
