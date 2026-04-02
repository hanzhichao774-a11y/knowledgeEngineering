import { useTaskStore } from '../../store/taskStore';
import styles from './LeftPanel.module.css';

const statusLabels: Record<string, { icon: string; text: string }> = {
  queued: { icon: '⏳', text: '排队中' },
  running: { icon: '🔄', text: '执行中' },
  completed: { icon: '✅', text: '已完成' },
  failed: { icon: '❌', text: '失败' },
};

export function TaskList() {
  const { tasks, activeTaskId, setActiveTask } = useTaskStore();

  return (
    <>
      <div className={styles.panelHeader}>
        任务列表
        <span className={styles.count}>{tasks.length}</span>
      </div>
      <div className={styles.taskList}>
        {tasks.map((task) => {
          const s = statusLabels[task.status] ?? statusLabels.queued;
          return (
            <div
              key={task.id}
              className={`${styles.taskItem} ${task.id === activeTaskId ? styles.taskItemActive : ''}`}
              onClick={() => setActiveTask(task.id)}
            >
              <div className={styles.taskTitle}>
                {task.icon} {task.title}
              </div>
              <div className={styles.taskMeta}>
                <span>{s.icon} {s.text}</span>
                <span>{task.createdAt}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
