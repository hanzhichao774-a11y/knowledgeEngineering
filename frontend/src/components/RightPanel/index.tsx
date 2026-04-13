import { useEffect, useMemo } from 'react';
import { useResultStore } from '../../store/resultStore';
import { useTaskStore } from '../../store/taskStore';
import { ResultTab } from './ResultTab';
import { AgentTab } from './AgentTab';
import { GraphTab } from './GraphTab';
import type { RightTab } from '../../types';
import styles from './RightPanel.module.css';

const allTabs: { id: RightTab; icon: string; label: string }[] = [
  { id: 'result', icon: '📊', label: '产出结果' },
  { id: 'agent', icon: '🧠', label: '智能体' },
  { id: 'graph', icon: '🕸️', label: '图谱' },
];

export function RightPanel() {
  const { activeTab, setActiveTab, answerContent, answerReport, ontologyResult, schemaContent } = useResultStore();
  const tasks = useTaskStore((s) => s.tasks);

  const hasResults = useMemo(() => {
    const finishedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'failed');
    return finishedTasks.length > 0 || !!answerContent || !!answerReport || !!ontologyResult || !!schemaContent;
  }, [tasks, answerContent, answerReport, ontologyResult, schemaContent]);

  const visibleTabs = useMemo(
    () => allTabs.filter((tab) => tab.id !== 'result' || hasResults),
    [hasResults],
  );

  useEffect(() => {
    if (activeTab === 'result' && !hasResults) {
      setActiveTab('agent');
    }
  }, [activeTab, hasResults, setActiveTab]);

  return (
    <>
      <div className={styles.tabs}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {activeTab === 'result' && <ResultTab />}
        {activeTab === 'agent' && <AgentTab />}
        {activeTab === 'graph' && <GraphTab />}
      </div>
    </>
  );
}
