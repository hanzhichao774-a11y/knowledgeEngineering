import { useResultStore } from '../../store/resultStore';
import { ResultTab } from './ResultTab';
import { AgentTab } from './AgentTab';
import { GraphTab } from './GraphTab';
import type { RightTab } from '../../types';
import styles from './RightPanel.module.css';

const tabs: { id: RightTab; icon: string; label: string }[] = [
  { id: 'result', icon: '📊', label: '产出结果' },
  { id: 'agent', icon: '🧠', label: '智能体' },
  { id: 'graph', icon: '🕸️', label: '图谱' },
];

export function RightPanel() {
  const { activeTab, setActiveTab } = useResultStore();

  return (
    <>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
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
