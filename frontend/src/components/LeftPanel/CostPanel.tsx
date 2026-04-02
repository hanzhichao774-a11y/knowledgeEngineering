import { useTaskStore } from '../../store/taskStore';
import styles from './LeftPanel.module.css';

export function CostPanel() {
  const task = useTaskStore((s) => {
    const id = s.activeTaskId;
    return id ? s.tasks.find((t) => t.id === id) : undefined;
  });

  if (!task) return null;

  return (
    <div className={styles.costPanel}>
      <h4 className={styles.sectionTitle}>资源消耗</h4>
      <div className={styles.costRow}>
        <span className={styles.costLabel}>输入 Token</span>
        <span className={styles.costVal}>{task.cost.inputTokens.toLocaleString()}</span>
      </div>
      <div className={styles.costRow}>
        <span className={styles.costLabel}>输出 Token</span>
        <span className={styles.costVal}>{task.cost.outputTokens.toLocaleString()}</span>
      </div>
      <div className={styles.costRow}>
        <span className={styles.costLabel}>预估费用</span>
        <span className={`${styles.costVal} ${styles.costGreen}`}>
          ¥ {task.cost.estimatedCost.toFixed(2)}
        </span>
      </div>
      <div className={styles.costRow}>
        <span className={styles.costLabel}>已用时间</span>
        <span className={styles.costVal}>{task.cost.elapsed}</span>
      </div>
    </div>
  );
}
