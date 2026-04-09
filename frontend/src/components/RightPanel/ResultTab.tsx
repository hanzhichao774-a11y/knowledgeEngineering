import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useResultStore } from '../../store/resultStore';
import { fetchGraphReport, fetchHealthReport } from '../../services/api';
import styles from './RightPanel.module.css';

export function ResultTab() {
  const { ontologyResult, schemaContent, schemaStatus, schemaProgress, documentSummary } =
    useResultStore();
  const graphData = useResultStore((s) => s.graphData);

  const [graphReport, setGraphReport] = useState<string | null>(null);
  const [healthReport, setHealthReport] = useState<string | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    if (!graphData) return;
    let cancelled = false;
    setLoadingReports(true);
    Promise.all([fetchGraphReport(), fetchHealthReport()])
      .then(([gr, hr]) => {
        if (cancelled) return;
        setGraphReport(gr.content);
        setHealthReport(hr.content);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingReports(false);
      });
    return () => { cancelled = true; };
  }, [graphData]);

  const classes = ontologyResult?.classes ?? [];
  const entities = ontologyResult?.entities ?? [];
  const relations = ontologyResult?.relations ?? [];
  const hasOntology = classes.length > 0 || entities.length > 0 || relations.length > 0;

  return (
    <div>
      {graphReport && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>📊</span>
            <span className={styles.resultTitle}>图谱分析报告</span>
            <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>GRAPH_REPORT</span>
          </div>
          <div className={styles.resultCardBody}>
            <div className={styles.markdownContent}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{graphReport}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {healthReport && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>🏥</span>
            <span className={styles.resultTitle}>健康报告</span>
            <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>HEALTH_REPORT</span>
          </div>
          <div className={styles.resultCardBody}>
            <div className={styles.markdownContent}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{healthReport}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {loadingReports && graphData && !graphReport && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>⏳</span>
            <span className={styles.resultTitle}>加载报告中...</span>
          </div>
        </div>
      )}

      {hasOntology && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>🔍</span>
            <span className={styles.resultTitle}>本体提取结果</span>
            <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>已完成</span>
          </div>
          <div className={styles.resultCardBody}>
            {classes.length > 0 && (
              <>
                <p className={styles.sectionLabel}>本体类 ({classes.length})</p>
                <table className={styles.schemaTable}>
                  <thead>
                    <tr><th>类名</th><th>描述</th></tr>
                  </thead>
                  <tbody>
                    {classes.map((c, i) => (
                      <tr key={i}>
                        <td><span className={`${styles.typeTag} ${styles.typeClass}`}>{c.name}</span></td>
                        <td>{c.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {entities.length > 0 && (
              <>
                <p className={styles.sectionLabel}>实体 ({entities.length})</p>
                <table className={styles.schemaTable}>
                  <thead>
                    <tr><th>名称</th><th>所属类</th><th>描述</th></tr>
                  </thead>
                  <tbody>
                    {entities.map((e, i) => (
                      <tr key={i}>
                        <td>{e.name}</td>
                        <td><span className={`${styles.typeTag} ${styles.typeEntity}`}>{e.class}</span></td>
                        <td>{e.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {relations.length > 0 && (
              <>
                <p className={styles.sectionLabel}>关系 ({relations.length})</p>
                <table className={styles.schemaTable}>
                  <thead>
                    <tr><th>关系</th><th>起始</th><th>目标</th><th>描述</th></tr>
                  </thead>
                  <tbody>
                    {relations.map((r, i) => (
                      <tr key={i}>
                        <td><span className={`${styles.typeTag} ${styles.typeRelation}`}>{r.name}</span></td>
                        <td>{r.source}</td>
                        <td>{r.target}</td>
                        <td>{r.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <p className={styles.resultFooter}>
              共 {ontologyResult?.classCount ?? classes.length} 个本体类 · {ontologyResult?.entityCount ?? entities.length} 个实体 · {ontologyResult?.relationCount ?? relations.length} 条关系
            </p>
          </div>
        </div>
      )}

      {schemaContent && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>📊</span>
            <span className={styles.resultTitle}>Schema 构建</span>
            <span className={`${styles.resultBadge} ${schemaStatus === 'done' ? styles.badgeSuccess : styles.badgeRunning}`}>
              {schemaStatus === 'done' ? '已完成' : `构建中 ${schemaProgress}%`}
            </span>
          </div>
          <div className={styles.resultCardBody}>
            <div className={styles.codeBlock} dangerouslySetInnerHTML={{ __html: schemaContent }} />
          </div>
        </div>
      )}

      {documentSummary && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>📄</span>
            <span className={styles.resultTitle}>文档摘要</span>
            <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>已完成</span>
          </div>
          <div className={styles.resultCardBody}>
            <p className={styles.summaryText}>{documentSummary}</p>
          </div>
        </div>
      )}

      {!hasOntology && !schemaContent && !documentSummary && !graphReport && !healthReport && (
        <div className={styles.emptyState}>
          <p>暂无产出结果</p>
          <p className={styles.emptyHint}>上传文档并启动任务后，结果将在此展示</p>
        </div>
      )}
    </div>
  );
}
