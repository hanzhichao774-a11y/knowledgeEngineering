import { useState } from 'react';
import { FileDown, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import type { ReportData } from '../../types';
import { exportReport } from '../../services/api';
import styles from './ReportCard.module.css';

const FORMAT_MAP = { Word: 'docx', Excel: 'xlsx', PDF: 'pdf' } as const;
type FormatLabel = keyof typeof FORMAT_MAP;

const trendIcon = {
  up: <TrendingUp size={12} className={styles.trendUp} />,
  down: <TrendingDown size={12} className={styles.trendDown} />,
  stable: <Minus size={12} className={styles.trendStable} />,
};

export function ReportCard({ report }: { report: ReportData }) {
  const [loadingFmt, setLoadingFmt] = useState<FormatLabel | null>(null);

  const handleDownload = async (fmt: FormatLabel) => {
    if (loadingFmt) return;
    const ext = FORMAT_MAP[fmt];
    setLoadingFmt(fmt);

    try {
      const blob = await exportReport(ext, report);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${report.title}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      alert(`${fmt} 导出失败，请稍后重试`);
    } finally {
      setLoadingFmt(null);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>📋</span>
        <div className={styles.headerText}>
          <div className={styles.title}>{report.title}</div>
          <div className={styles.period}>{report.period}</div>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        {report.metrics.map((m, i) => (
          <div key={i} className={styles.metric}>
            <div className={styles.metricLabel}>{m.label}</div>
            <div className={styles.metricValue}>
              {m.value}
              {m.unit && <span className={styles.metricUnit}>{m.unit}</span>}
              {m.trend && trendIcon[m.trend]}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.summarySection}>
        <div className={styles.summaryTitle}>核心发现</div>
        <ul className={styles.summaryList}>
          {report.summary.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      <div className={styles.footer}>
        <span className={styles.source}>{report.source}</span>
        <div className={styles.downloadBtns}>
          {(['Word', 'Excel', 'PDF'] as const).map((fmt) => (
            <button
              key={fmt}
              className={styles.downloadBtn}
              onClick={() => handleDownload(fmt)}
              disabled={loadingFmt !== null}
            >
              {loadingFmt === fmt
                ? <Loader2 size={11} className={styles.spinner} />
                : <FileDown size={11} />}
              {loadingFmt === fmt ? '生成中…' : fmt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
