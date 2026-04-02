import { useResultStore } from '../../store/resultStore';
import styles from './RightPanel.module.css';

const typeTagClass: Record<string, string> = {
  entity: styles.typeEntity,
  relation: styles.typeRelation,
  attr: styles.typeAttr,
};

const typeLabel: Record<string, string> = {
  entity: '实体',
  relation: '关系',
  attr: '属性',
};

export function ResultTab() {
  const { ontologyResult, schemaContent, schemaStatus, schemaProgress, documentSummary } =
    useResultStore();

  return (
    <div>
      {/* Ontology Extraction Result */}
      {ontologyResult && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>🔍</span>
            <span className={styles.resultTitle}>本体提取结果</span>
            <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>已完成</span>
          </div>
          <div className={styles.resultCardBody}>
            <table className={styles.schemaTable}>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>描述</th>
                </tr>
              </thead>
              <tbody>
                {ontologyResult.entities.map((e, i) => (
                  <tr key={i}>
                    <td>{e.name}</td>
                    <td>
                      <span className={`${styles.typeTag} ${typeTagClass[e.type] ?? ''}`}>
                        {typeLabel[e.type] ?? e.type}
                      </span>
                    </td>
                    <td>{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.resultFooter}>
              共 {ontologyResult.entityCount} 个实体 · {ontologyResult.relationCount} 条关系 · 点击查看全部 →
            </p>
          </div>
        </div>
      )}

      {/* Schema Building */}
      {schemaContent && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>📊</span>
            <span className={styles.resultTitle}>Schema 构建</span>
            <span
              className={`${styles.resultBadge} ${
                schemaStatus === 'done' ? styles.badgeSuccess : styles.badgeRunning
              }`}
            >
              {schemaStatus === 'done' ? '已完成' : `构建中 ${schemaProgress}%`}
            </span>
          </div>
          <div className={styles.resultCardBody}>
            <div
              className={styles.codeBlock}
              dangerouslySetInnerHTML={{ __html: schemaContent }}
            />
          </div>
        </div>
      )}

      {/* Document Summary */}
      {documentSummary && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>📄</span>
            <span className={styles.resultTitle}>文档摘要</span>
            <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>已完成</span>
          </div>
          <div className={styles.resultCardBody}>
            <p className={styles.summaryText}>{documentSummary}</p>
            <div style={{ marginTop: 8 }}>
              <a href="#" className={styles.viewLink}>📎 查看原文 →</a>
            </div>
          </div>
        </div>
      )}

      {!ontologyResult && !schemaContent && !documentSummary && (
        <div className={styles.emptyState}>
          <p>暂无产出结果</p>
          <p className={styles.emptyHint}>上传文档并启动任务后，结果将在此展示</p>
        </div>
      )}
    </div>
  );
}
