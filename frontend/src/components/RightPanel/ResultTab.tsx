import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle, XCircle, Loader2, ChevronRight } from 'lucide-react';
import { useResultStore } from '../../store/resultStore';
import { useTaskStore } from '../../store/taskStore';
import { fetchTaskResult } from '../../services/api';
import { ReportCard } from '../CenterPanel/ReportCard';
import type { Task } from '../../types';
import styles from './RightPanel.module.css';

function escapeSchemaHtml(schema: string): string {
  return schema
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function applyResultToStore(result: Record<string, unknown>) {
  const store = useResultStore.getState();
  if (result.answer) {
    store.setAnswerContent(result.answer as string);
  }
  if (result.summary) {
    store.setDocumentSummary(result.summary as string);
  }
  if ((result.ontology as Record<string, unknown>)?.entityCount) {
    store.setOntologyResult(result.ontology as Parameters<typeof store.setOntologyResult>[0]);
  }
  if (result.schema) {
    store.setSchemaContent(escapeSchemaHtml(result.schema as string));
    store.setSchemaStatus('done');
    store.setSchemaProgress(100);
  }
}

export function ResultTab() {
  const tasks = useTaskStore((s) => s.tasks);
  const {
    answerContent, answerReport,
    ontologyResult, schemaContent, schemaStatus, schemaProgress,
  } = useResultStore();
  const cacheTaskResult = useResultStore((s) => s.cacheTaskResult);

  const finishedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'failed');

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedTaskId;

  const handleSelectTask = useCallback(async (task: Task) => {
    if (selectedRef.current === task.id) {
      setSelectedTaskId(null);
      return;
    }
    setSelectedTaskId(task.id);

    const cached = useResultStore.getState().taskResults[task.id];
    if (cached) {
      applyResultToStore(cached as unknown as Record<string, unknown>);
      return;
    }

    setLoadingId(task.id);
    try {
      const result = await fetchTaskResult(task.id);
      if (result && !result.error) {
        applyResultToStore(result);
        cacheTaskResult(task.id, {
          ontology: result.ontology?.entityCount ? result.ontology : undefined,
          schema: result.schema || undefined,
          summary: result.summary || undefined,
          answer: result.answer || undefined,
        });
      }
    } catch { /* silently ignore */ }
    finally {
      setLoadingId(null);
    }
  }, [cacheTaskResult]);

  const classes = ontologyResult?.classes ?? [];
  const entities = ontologyResult?.entities ?? [];
  const relations = ontologyResult?.relations ?? [];
  const hasOntology = classes.length > 0 || entities.length > 0 || relations.length > 0;
  const hasAny = finishedTasks.length > 0 || answerContent || answerReport || hasOntology || schemaContent;

  return (
    <div>
      {finishedTasks.length > 0 && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>📋</span>
            <span className={styles.resultTitle}>已生成结果（{finishedTasks.length}）</span>
          </div>
          <div className={styles.resultCardBody} style={{ padding: 0 }}>
            {finishedTasks.map((task) => (
              <button
                key={task.id}
                className={`${styles.taskListItem} ${selectedTaskId === task.id ? styles.taskListItemActive : ''}`}
                onClick={() => handleSelectTask(task)}
              >
                {task.status === 'completed' ? (
                  <CheckCircle size={14} className={styles.taskIconDone} />
                ) : (
                  <XCircle size={14} className={styles.taskIconFailed} />
                )}
                <span className={styles.taskListTitle}>{task.title}</span>
                <span className={styles.taskListTime}>
                  {new Date(task.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                </span>
                {loadingId === task.id ? (
                  <Loader2 size={12} className={styles.taskListSpin} />
                ) : (
                  <ChevronRight size={12} className={`${styles.taskListChevron} ${selectedTaskId === task.id ? styles.taskListChevronOpen : ''}`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {answerContent && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>💡</span>
            <span className={styles.resultTitle}>回答结果</span>
            <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>已完成</span>
          </div>
          <div className={`${styles.resultCardBody} ${styles.markdownBody}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answerContent}</ReactMarkdown>
          </div>
        </div>
      )}

      {answerReport && (
        <div className={styles.resultCard}>
          <div className={styles.resultCardHeader}>
            <span className={styles.resultIcon}>📊</span>
            <span className={styles.resultTitle}>分析报告</span>
            <span className={`${styles.resultBadge} ${styles.badgeSuccess}`}>已完成</span>
          </div>
          <div className={styles.resultCardBody}>
            <ReportCard report={answerReport} />
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
                  <thead><tr><th>类名</th><th>描述</th></tr></thead>
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
                  <thead><tr><th>名称</th><th>所属类</th><th>描述</th></tr></thead>
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
                  <thead><tr><th>关系</th><th>起始</th><th>目标</th><th>描述</th></tr></thead>
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

      {!hasAny && (
        <div className={styles.emptyState}>
          <p>暂无产出结果</p>
          <p className={styles.emptyHint}>上传文档并启动任务后，结果将在此展示</p>
        </div>
      )}
    </div>
  );
}
