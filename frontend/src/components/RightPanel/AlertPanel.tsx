import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { MOCK_ALERTS } from '../../constants/alertMockData';
import type { AlertItem, AlertSeverity } from '../../types';
import styles from './AlertPanel.module.css';

const severityConfig: Record<AlertSeverity, { label: string; className: string }> = {
  high: { label: '高', className: styles.severityHigh },
  medium: { label: '中', className: styles.severityMedium },
  low: { label: '低', className: styles.severityLow },
};

const categoryLabels: Record<string, string> = {
  anomaly: '数据异常',
  threshold: '阈值突破',
  missing: '数据缺失',
};

export function AlertPanel() {
  const [expanded, setExpanded] = useState(true);
  const alerts = MOCK_ALERTS;
  const highCount = alerts.filter((a) => a.severity === 'high').length;

  return (
    <div className={styles.container}>
      <button className={styles.header} onClick={() => setExpanded(!expanded)}>
        <AlertTriangle size={14} className={styles.headerIcon} />
        <span className={styles.headerTitle}>智能预警</span>
        {highCount > 0 && (
          <span className={styles.badge}>{highCount}</span>
        )}
        <span className={styles.alertCount}>{alerts.length} 条</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className={styles.list}>
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const sev = severityConfig[alert.severity];
  return (
    <div className={styles.card}>
      <div className={styles.cardLeft}>
        <div className={`${styles.severityBar} ${sev.className}`} />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={`${styles.severityTag} ${sev.className}`}>{sev.label}</span>
          <span className={styles.categoryTag}>{categoryLabels[alert.category]}</span>
          <span className={styles.cardTime}>{alert.time}</span>
        </div>
        <div className={styles.cardTitle}>{alert.title}</div>
        <div className={styles.cardDesc}>{alert.description}</div>
        <div className={styles.cardSource}>来源：{alert.source}</div>
      </div>
    </div>
  );
}
