import { useTaskStore } from '../../store/taskStore';
import styles from './LeftPanel.module.css';

export function StepProgress() {
  const task = useTaskStore((s) => {
    const id = s.activeTaskId;
    return id ? s.tasks.find((t) => t.id === id) : undefined;
  });

  if (!task) return null;

  return (
    <div className={styles.stepList}>
      <h4 className={styles.sectionTitle}>执行进度</h4>
      {task.steps.map((step, i) => {
        const dotClass =
          step.status === 'done' ? styles.stepDone
          : step.status === 'running' ? styles.stepRunning
          : step.status === 'error' ? styles.stepError
          : step.status === 'skipped' ? styles.stepSkipped
          : styles.stepPending;

        const dotIcon =
          step.status === 'done' ? '✓'
          : step.status === 'running' ? '⟳'
          : step.status === 'error' ? '✕'
          : step.status === 'skipped' ? '–'
          : '';

        const nameColor =
          step.status === 'running' ? 'var(--yellow)'
          : step.status === 'error' ? 'var(--red, #ef4444)'
          : step.status === 'pending' || step.status === 'skipped' ? 'var(--text-muted)'
          : undefined;

        return (
          <div key={i} className={styles.step}>
            <div className={`${styles.stepDot} ${dotClass}`}>{dotIcon}</div>
            <div className={styles.stepInfo}>
              <div className={styles.stepName} style={{ color: nameColor }}>
                {step.name}
              </div>
              {step.status === 'done' && step.duration != null && (
                <div className={styles.stepTime}>
                  耗时 {step.duration.toFixed(1)}s · {step.tokenUsed.toLocaleString()} tokens
                </div>
              )}
              {step.status === 'running' && (
                <div className={styles.stepTime}>进行中...</div>
              )}
              {step.status === 'error' && (
                <div className={styles.stepTime} style={{ color: 'var(--red, #ef4444)' }}>
                  执行失败
                </div>
              )}
              {step.status === 'skipped' && (
                <div className={styles.stepTime}>已跳过</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
