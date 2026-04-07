import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../types';
import styles from './CenterPanel.module.css';

const avatarConfig: Record<string, { emoji: string; className: string }> = {
  user: { emoji: '👤', className: styles.avatarUser },
  manager: { emoji: '🧠', className: styles.avatarManager },
  worker: { emoji: '📝', className: styles.avatarWorker },
  assistant: { emoji: '💡', className: styles.avatarAssistant },
  system: { emoji: '⚙️', className: styles.avatarSystem },
};

const roleLabels: Record<string, { text: string; className: string }> = {
  user: { text: '用户', className: styles.roleUser },
  manager: { text: '管理', className: styles.roleManager },
  worker: { text: '数字员工', className: styles.roleWorker },
  assistant: { text: '知识助手', className: styles.roleAssistant },
  system: { text: '系统', className: styles.roleSystem },
};

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  const avatar = avatarConfig[msg.role] ?? avatarConfig.system;
  const role = roleLabels[msg.role] ?? roleLabels.system;

  return (
    <div className={styles.msg}>
      <div className={`${styles.msgAvatar} ${avatar.className}`}>{avatar.emoji}</div>
      <div className={styles.msgBody}>
        <div className={styles.msgHeader}>
          <span className={styles.msgName}>{msg.name}</span>
          <span className={`${styles.msgRole} ${role.className}`}>{role.text}</span>
          <span className={styles.msgTime}>{msg.timestamp}</span>
        </div>
        {msg.role === 'assistant' ? (
          <div className={`${styles.msgContent} ${styles.markdownContent}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <div
            className={styles.msgContent}
            dangerouslySetInnerHTML={{ __html: msg.content }}
          />
        )}
        {msg.attachment && (
          <div className={styles.filePreview}>
            <span className={styles.fileIcon}>📄</span>
            <div className={styles.fileInfo}>
              <div className={styles.fileName}>{msg.attachment.name}</div>
              <div className={styles.fileSize}>
                {msg.attachment.size}
                {msg.attachment.pages ? ` · ${msg.attachment.pages} 页` : ''}
              </div>
            </div>
          </div>
        )}
        {msg.agentStatus && (
          <div className={styles.agentStatusCard}>
            <div className={styles.agentStatusRow}>
              <span className={styles.agentStatusLabel}>Skill</span>
              <span className={styles.skillTag}>
                {msg.agentStatus.skillIcon} {msg.agentStatus.skill}
              </span>
            </div>
            <div className={styles.agentStatusRow}>
              <span className={styles.agentStatusLabel}>Token</span>
              <div className={styles.tokenBar}>
                <div
                  className={styles.tokenBarFill}
                  style={{
                    width: `${Math.min(100, (msg.agentStatus.tokenUsed / msg.agentStatus.tokenLimit) * 100)}%`,
                  }}
                />
              </div>
              <span className={styles.tokenText}>
                {msg.agentStatus.tokenUsed.toLocaleString()} / {msg.agentStatus.tokenLimit.toLocaleString()}
              </span>
            </div>
            <div className={styles.agentStatusRow}>
              <span className={styles.agentStatusLabel}>状态</span>
              {msg.agentStatus.status === 'done' ? (
                <span className={styles.statusDone}>
                  ✅ 完成{msg.agentStatus.duration != null ? ` · ${msg.agentStatus.duration}s` : ''}
                </span>
              ) : msg.agentStatus.status === 'running' ? (
                <span className={styles.statusRunning}>⟳ 执行中...</span>
              ) : (
                <span className={styles.statusError}>❌ 错误</span>
              )}
            </div>
          </div>
        )}
        {msg.thinking && (
          <div className={styles.thinkingIndicator}>
            <div className={styles.thinkingDots}>
              <span /><span /><span />
            </div>
            {msg.thinking}
          </div>
        )}
      </div>
    </div>
  );
}
