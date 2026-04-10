import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../types';
import { ReportCard } from './ReportCard';
import styles from './CenterPanel.module.css';

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className={styles.userRow}>
        <div className={styles.userBubbleWrap}>
          <div className={styles.userMeta}>
            <span className={styles.userLabel}>用户</span>
            <div className={styles.userAvatarSmall}>👤</div>
          </div>
          <div className={styles.userBubble} dangerouslySetInnerHTML={{ __html: msg.content }} />
          {(msg.attachments ?? (msg.attachment ? [msg.attachment] : [])).map((att, i) => (
            <div className={styles.filePreview} key={`${att.name}-${i}`}>
              <span className={styles.fileIcon}>📄</span>
              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{att.name}</div>
                <div className={styles.fileSize}>
                  {att.size}
                  {att.pages ? ` · ${att.pages} 页` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (msg.role === 'assistant') {
    return (
      <div className={styles.assistantRow}>
        <div className={styles.assistantMeta}>
          <div className={styles.assistantAvatar}>💡</div>
          <span className={styles.assistantName}>{msg.name || '知识助手'}</span>
        </div>
        <div className={`${styles.assistantBubble} ${styles.markdownContent}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
        {msg.report && <ReportCard report={msg.report} />}
      </div>
    );
  }

  return (
    <div className={styles.msg}>
      <div className={`${styles.msgAvatar} ${styles.avatarSystem}`}>⚙️</div>
      <div className={styles.msgBody}>
        <div className={styles.msgHeader}>
          <span className={styles.msgName}>{msg.name}</span>
          <span className={`${styles.msgRole} ${styles.roleSystem}`}>系统</span>
          <span className={styles.msgTime}>{msg.timestamp}</span>
        </div>
        <div className={styles.msgContent} dangerouslySetInnerHTML={{ __html: msg.content }} />
      </div>
    </div>
  );
}
