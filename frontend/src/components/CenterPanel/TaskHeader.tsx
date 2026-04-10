import { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Clock, Cpu } from 'lucide-react';
import { useTaskStore } from '../../store/taskStore';
import { useResultStore } from '../../store/resultStore';
import styles from './CenterPanel.module.css';

const statusMap: Record<string, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'var(--text-muted)' },
  running: { label: '执行中', color: 'var(--yellow)' },
  completed: { label: '已完成', color: 'var(--green)' },
  failed: { label: '失败', color: 'var(--red)' },
};

export function TaskHeader() {
  const task = useTaskStore((s) => {
    const id = s.activeTaskId;
    return id ? s.tasks.find((t) => t.id === id) : undefined;
  });
  const agentDetail = useResultStore((s) => s.agentDetail);
  const [costOpen, setCostOpen] = useState(false);

  if (!task) {
    return (
      <div className={styles.taskHeader}>
        <div className={styles.thEmpty}>
          <Cpu size={13} className={styles.thEmptyIcon} />
          <span>等待任务...</span>
        </div>
      </div>
    );
  }

  const st = statusMap[task.status] ?? statusMap.queued;
  const doneSteps = task.steps.filter((s) => s.status === 'done').length;
  const totalSteps = task.steps.length;
  const runningStep = task.steps.find((s) => s.status === 'running');
  const totalTokens = task.cost.inputTokens + task.cost.outputTokens;

  return (
    <div className={styles.taskHeader}>
      <div className={styles.thRow}>
        <span className={styles.thIcon}>{task.icon}</span>
        <span className={styles.thTitle}>{task.title}</span>

        <span className={styles.thDivider} />

        <span className={styles.thStatusDot} style={{ background: st.color }} />
        <span className={styles.thStatus} style={{ color: st.color }}>{st.label}</span>

        {agentDetail && (
          <>
            <span className={styles.thDivider} />
            <Cpu size={11} className={styles.thMetaIcon} />
            <span className={styles.thMeta}>{agentDetail.name}</span>
          </>
        )}

        {totalSteps > 0 && (
          <>
            <span className={styles.thDivider} />
            <Zap size={11} className={styles.thMetaIcon} />
            <span className={styles.thMeta}>{doneSteps}/{totalSteps}</span>
          </>
        )}

        {runningStep && (
          <>
            <span className={styles.thDivider} />
            <span className={styles.thRunning}>{runningStep.skillIcon} {runningStep.skill}</span>
          </>
        )}

        <button
          className={styles.thCostBtn}
          onClick={() => setCostOpen((v) => !v)}
          title="资源消耗"
        >
          <Clock size={11} />
          <span>{totalTokens > 0 ? totalTokens.toLocaleString() : '0'} tok</span>
          {costOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {costOpen && (
        <div className={styles.thCostDrop}>
          <div className={styles.thCostItem}>
            <span>输入 Token</span>
            <span>{task.cost.inputTokens.toLocaleString()}</span>
          </div>
          <div className={styles.thCostItem}>
            <span>输出 Token</span>
            <span>{task.cost.outputTokens.toLocaleString()}</span>
          </div>
          <div className={styles.thCostItem}>
            <span>预估费用</span>
            <span className={styles.thCostGreen}>¥ {task.cost.estimatedCost.toFixed(2)}</span>
          </div>
          <div className={styles.thCostItem}>
            <span>已用时间</span>
            <span>{task.cost.elapsed}</span>
          </div>
        </div>
      )}
    </div>
  );
}
