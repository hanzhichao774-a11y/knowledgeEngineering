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
      {task.steps.map((step, i) => (
        <div key={i} className={styles.step}>
          <div
            className={`${styles.stepDot} ${
              step.status === 'done'
                ? styles.stepDone
                : step.status === 'running'
                  ? styles.stepRunning
                  : styles.stepPending
            }`}
          >
            {step.status === 'done' ? '✓' : step.status === 'running' ? '⟳' : ''}
          </div>
          <div className={styles.stepInfo}>
            <div
              className={styles.stepName}
              style={{
                color:
                  step.status === 'running'
                    ? 'var(--yellow)'
                    : step.status === 'pending'
                      ? 'var(--text-muted)'
                      : undefined,
              }}
            >
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
          </div>
        </div>
      ))}
    </div>
  );
}
