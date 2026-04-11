import { useState, useRef, useEffect } from 'react';
import { Activity, Trash2, Zap } from 'lucide-react';
import { useTaskStore } from '../../store/taskStore';
import { useChatStore } from '../../store/chatStore';
import { useResultStore } from '../../store/resultStore';
import { SkillTab } from '../RightPanel/SkillTab';
import styles from './Header.module.css';

export function Header() {
  const clearTasks = useTaskStore((s) => s.clearAll);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const clearResults = useResultStore((s) => s.clearAll);

  const [skillOpen, setSkillOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!skillOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setSkillOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [skillOpen]);

  const handleClearData = () => {
    if (!window.confirm('确定清除所有任务数据吗？此操作不会删除图数据库中的知识。')) return;
    clearTasks();
    clearMessages();
    clearResults();
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Activity size={18} className={styles.logoIcon} />
        <div className={styles.logo}>
        BizAgentOS<span className={styles.logoSub}>· 多智能体操作系统</span>
        </div>
        <div className={styles.skillBtnWrap}>
          <button
            ref={btnRef}
            className={`${styles.skillBtn} ${skillOpen ? styles.skillBtnActive : ''}`}
            onClick={() => setSkillOpen((v) => !v)}
          >
            <Zap size={12} />
            系统技能
          </button>
          {skillOpen && (
            <div ref={panelRef} className={styles.skillPanel}>
              <SkillTab />
            </div>
          )}
        </div>
      </div>
      <div className={styles.right}>
        <span className={styles.tag}>
          <span className={styles.statusDot} />
          系统正常
        </span>
        <span className={styles.tag}>MiniMax</span>
        <span className={styles.tag}>👤 张闯</span>
        <button
          className={styles.clearBtn}
          onClick={handleClearData}
          title="清除当前任务数据"
        >
          <Trash2 size={13} />
          清除数据
        </button>
      </div>
    </header>
  );
}
