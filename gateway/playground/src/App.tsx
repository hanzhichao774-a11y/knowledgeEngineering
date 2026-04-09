import { useMemo, useState } from 'react';

type EndpointKey = 'health' | 'intent' | 'skill' | 'answer';

interface RequestResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  latencyMs?: number;
  httpStatus?: number;
  body?: unknown;
  error?: string;
}

interface PlaygroundFileInfo {
  id?: string;
  name?: string;
  filename?: string;
  storedPath?: string;
  path?: string;
  size: number;
  uploadedAt?: string;
  updatedAt?: string;
}

const skillPresets: Record<string, Record<string, unknown>> = {
  'document-parse-summary': {
    traceId: 'playground-doc',
    taskId: 'playground-doc',
    workspaceId: 'default',
    skillName: 'document-parse-summary',
    input: {
      documentText:
        '# 周报\n\n本周共巡检 3 个站点，发现 2 个告警，完成 5 项整改。\n\n| 站点 | 告警数 | 状态 |\n| --- | --- | --- |\n| A站 | 1 | 已恢复 |\n| B站 | 1 | 处理中 |\n| C站 | 0 | 正常 |',
    },
  },
  'ontology-extract': {
    traceId: 'playground-ontology',
    taskId: 'playground-ontology',
    workspaceId: 'default',
    skillName: 'ontology-extract',
    input: {
      documentText:
        '# 巡检记录\n\n2026-04-08 巡检 A站，温度 42C，电压 220V。\n2026-04-08 巡检 B站，温度 39C，电压 219V。',
    },
  },
  'schema-build': {
    traceId: 'playground-schema',
    taskId: 'playground-schema',
    workspaceId: 'default',
    skillName: 'schema-build',
    input: {
      ontologyData: {
        classes: [{ name: '站点', desc: '巡检站点' }],
        entities: [{ name: 'A站', class: '站点', desc: '站点A' }],
        relations: [],
        attributes: [{ name: '温度', entity: 'A站', value: '42C', desc: '温度值' }],
      },
    },
  },
  'answer-generate': {
    traceId: 'playground-answer-skill',
    taskId: 'playground-answer-skill',
    workspaceId: 'default',
    skillName: 'answer-generate',
    input: {
      question: 'A站温度是多少？',
      outputMode: 'structured',
      retrievalContext: {
        source: 'graphify',
        graphifySources: ['weekly-report.md'],
        recordResults: [{ source_file: 'weekly-report.md', location: '2.1', content: 'A站温度 42C' }],
        facts: [{ site: 'A站', temperature: '42C' }],
      },
    },
  },
};

const endpointMeta: Record<EndpointKey, { title: string; method: string; path: string; note: string }> = {
  health: {
    title: 'Health',
    method: 'GET',
    path: '/api/gateway/v1/health',
    note: '检查 provider、skills 和 readiness。',
  },
  intent: {
    title: 'Intent Classify',
    method: 'POST',
    path: '/api/gateway/v1/intent/classify',
    note: '测试 ingest / query 二分类。',
  },
  skill: {
    title: 'Skills Run',
    method: 'POST',
    path: '/api/gateway/v1/skills/run',
    note: '测试 4 个硬编码 skill 的真实行为。',
  },
  answer: {
    title: 'Answer Generate',
    method: 'POST',
    path: '/api/gateway/v1/answer/generate',
    note: '测试 text / structured / artifact-draft 输出模式。',
  },
};

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function buildCurlPreview(path: string, method: string, body?: string): string {
  const base = `curl -X ${method} http://127.0.0.1:3011${path}`;
  if (!body) return base;
  return `${base} \\\n  -H 'content-type: application/json' \\\n  --data '${body.replace(/'/g, "\\'")}'`;
}

async function requestJson(path: string, method: string, body?: unknown): Promise<{ httpStatus: number; body: unknown; latencyMs: number }> {
  const startedAt = performance.now();
  const response = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const latencyMs = Math.round(performance.now() - startedAt);
  const payload = await response.json();
  return { httpStatus: response.status, body: payload, latencyMs };
}

export default function App() {
  const [active, setActive] = useState<EndpointKey>('health');
  const [intentBody, setIntentBody] = useState(
    prettyJson({
      traceId: 'playground-intent',
      taskId: 'playground-intent',
      workspaceId: 'default',
      query: '帮我总结这份文档并抽取知识点',
      hasFile: true,
      context: { neo4jConnected: true },
    }),
  );
  const [selectedSkill, setSelectedSkill] = useState<keyof typeof skillPresets>('document-parse-summary');
  const [skillBody, setSkillBody] = useState(prettyJson(skillPresets['document-parse-summary']));
  const [answerBody, setAnswerBody] = useState(
    prettyJson({
      traceId: 'playground-answer',
      taskId: 'playground-answer',
      workspaceId: 'default',
      question: 'A站温度是多少？',
      outputMode: 'structured',
      retrievalContext: {
        source: 'graphify',
        graphifySources: ['weekly-report.md'],
        recordResults: [{ source_file: 'weekly-report.md', location: '2.1', content: 'A站温度 42C' }],
        facts: [{ site: 'A站', temperature: '42C' }],
      },
    }),
  );
  const [results, setResults] = useState<Record<EndpointKey, RequestResult>>({
    health: { status: 'idle' },
    intent: { status: 'idle' },
    skill: { status: 'idle' },
    answer: { status: 'idle' },
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [replaceExistingUploads, setReplaceExistingUploads] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<unknown>(null);
  const [runningGraphify, setRunningGraphify] = useState(false);
  const [runGraphifyResult, setRunGraphifyResult] = useState<unknown>(null);
  const [graphifyStatusLoading, setGraphifyStatusLoading] = useState(false);
  const [graphifyStatus, setGraphifyStatus] = useState<unknown>(null);
  const [graphifyFiles, setGraphifyFiles] = useState<PlaygroundFileInfo[]>([]);
  const [querying, setQuerying] = useState(false);
  const [graphifyQuestion, setGraphifyQuestion] = useState('这些文件里关于访问控制、权限或巡检异常的重点是什么？');
  const [graphifyQueryResult, setGraphifyQueryResult] = useState<unknown>(null);
  const [graphifyQueryError, setGraphifyQueryError] = useState<string | null>(null);

  const currentMeta = endpointMeta[active];
  const currentBody = useMemo(() => {
    if (active === 'intent') return intentBody;
    if (active === 'skill') return skillBody;
    if (active === 'answer') return answerBody;
    return '';
  }, [active, answerBody, intentBody, skillBody]);
  const currentResult = results[active];
  const curlPreview = buildCurlPreview(currentMeta.path, currentMeta.method, currentBody || undefined);

  async function runRequest(key: EndpointKey, path: string, method: string, bodyText?: string) {
    setResults((prev) => ({
      ...prev,
      [key]: { status: 'loading' },
    }));

    try {
      const parsedBody = bodyText ? JSON.parse(bodyText) : undefined;
      const response = await requestJson(path, method, parsedBody);
      setResults((prev) => ({
        ...prev,
        [key]: {
          status: response.httpStatus >= 200 && response.httpStatus < 300 ? 'success' : 'error',
          httpStatus: response.httpStatus,
          latencyMs: response.latencyMs,
          body: response.body,
        },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [key]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Request failed',
        },
      }));
    }
  }

  async function loadGraphifyStatus() {
    setGraphifyStatusLoading(true);
    try {
      const response = await requestJson('/api/graphify-playground/status', 'GET');
      setGraphifyStatus(response.body);
      const payload = response.body as { files?: PlaygroundFileInfo[] };
      setGraphifyFiles(payload.files ?? []);
    } catch (error) {
      setGraphifyStatus({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load graphify status',
      });
    } finally {
      setGraphifyStatusLoading(false);
    }
  }

  async function uploadGraphifyFiles() {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append('files', file);
      }

      const response = await fetch(`/api/graphify-playground/upload?replaceExisting=${replaceExistingUploads ? 'true' : 'false'}`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      setUploadResult(payload);
      if (response.ok) {
        setSelectedFiles([]);
        setRunGraphifyResult(null);
        const nextFiles = (payload as { uploadedFiles?: PlaygroundFileInfo[] }).uploadedFiles ?? [];
        setGraphifyFiles(nextFiles);
        await loadGraphifyStatus();
      }
    } catch (error) {
      setUploadResult({
        ok: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  }

  async function runGraphifyBuild() {
    setRunningGraphify(true);
    setRunGraphifyResult(null);
    try {
      const response = await requestJson('/api/graphify-playground/run', 'POST');
      setRunGraphifyResult(response.body);
      await loadGraphifyStatus();
    } catch (error) {
      setRunGraphifyResult({
        ok: false,
        error: error instanceof Error ? error.message : 'Run graphify failed',
      });
    } finally {
      setRunningGraphify(false);
    }
  }

  async function queryGraphifyKnowledge() {
    if (!graphifyQuestion.trim()) return;
    setQuerying(true);
    setGraphifyQueryError(null);
    try {
      const response = await requestJson('/api/graphify-playground/query', 'POST', {
        question: graphifyQuestion,
        graphifyFormat: 'structured',
        outputMode: 'text',
        topN: 5,
        recordTopN: 10,
      });
      if (response.httpStatus < 200 || response.httpStatus >= 300) {
        setGraphifyQueryError(prettyJson(response.body));
        setGraphifyQueryResult(null);
      } else {
        setGraphifyQueryResult(response.body);
      }
    } catch (error) {
      setGraphifyQueryResult(null);
      setGraphifyQueryError(error instanceof Error ? error.message : 'Query failed');
    } finally {
      setQuerying(false);
    }
  }

  const gatewayAnswerPreview = useMemo(() => {
    if (!graphifyQueryResult || typeof graphifyQueryResult !== 'object') return '';
    const gateway = (graphifyQueryResult as Record<string, unknown>).gateway;
    if (!gateway || typeof gateway !== 'object') return '';
    const answer = (gateway as Record<string, unknown>).answer;
    return typeof answer === 'string' ? answer : '';
  }, [graphifyQueryResult]);

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Gateway Alignment Console</p>
          <h1>测试 gateway 与 graphify 的联调链路</h1>
          <p className="hero-copy">
            上半区保留 gateway 接口测试，下半区新增 Graphify Lab，可以上传多种格式文件到 graphify workspace、触发 rebuild，并继续做知识库查询。
          </p>
        </div>
        <div className="hero-badges">
          <span>Gateway: :3011</span>
          <span>Backend: :3001</span>
          <span>Playground: :3021</span>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="endpoint-list">
          {(['health', 'intent', 'skill', 'answer'] as EndpointKey[]).map((key) => {
            const item = endpointMeta[key];
            const result = results[key];
            return (
              <button
                key={key}
                className={`endpoint-card ${active === key ? 'active' : ''}`}
                onClick={() => setActive(key)}
                type="button"
              >
                <div className="endpoint-header">
                  <span className="method-pill">{item.method}</span>
                  <strong>{item.title}</strong>
                </div>
                <code>{item.path}</code>
                <p>{item.note}</p>
                <span className={`status-pill ${result.status}`}>{result.status}</span>
              </button>
            );
          })}
        </aside>

        <section className="panel-stack">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Gateway Request</p>
                <h2>{currentMeta.title}</h2>
              </div>
              {active === 'health' ? <button className="primary-button" onClick={() => runRequest('health', currentMeta.path, currentMeta.method)} type="button">Run Health</button> : null}
              {active === 'intent' ? <button className="primary-button" onClick={() => runRequest('intent', endpointMeta.intent.path, endpointMeta.intent.method, intentBody)} type="button">Run Intent</button> : null}
              {active === 'skill' ? <button className="primary-button" onClick={() => runRequest('skill', endpointMeta.skill.path, endpointMeta.skill.method, skillBody)} type="button">Run Skill</button> : null}
              {active === 'answer' ? <button className="primary-button" onClick={() => runRequest('answer', endpointMeta.answer.path, endpointMeta.answer.method, answerBody)} type="button">Run Answer</button> : null}
            </div>

            {active === 'health' ? <div className="hint-box">`health` 不需要请求体，适合先看 gateway readiness。</div> : null}
            {active === 'intent' ? (
              <label className="editor-block">
                <span>JSON Body</span>
                <textarea value={intentBody} onChange={(event) => setIntentBody(event.target.value)} spellCheck={false} />
              </label>
            ) : null}
            {active === 'skill' ? (
              <>
                <div className="preset-row">
                  {Object.keys(skillPresets).map((skillName) => (
                    <button
                      key={skillName}
                      className={`preset-button ${selectedSkill === skillName ? 'active' : ''}`}
                      onClick={() => {
                        const nextSkill = skillName as keyof typeof skillPresets;
                        setSelectedSkill(nextSkill);
                        setSkillBody(prettyJson(skillPresets[nextSkill]));
                      }}
                      type="button"
                    >
                      {skillName}
                    </button>
                  ))}
                </div>
                <label className="editor-block">
                  <span>JSON Body</span>
                  <textarea value={skillBody} onChange={(event) => setSkillBody(event.target.value)} spellCheck={false} />
                </label>
              </>
            ) : null}
            {active === 'answer' ? (
              <label className="editor-block">
                <span>JSON Body</span>
                <textarea value={answerBody} onChange={(event) => setAnswerBody(event.target.value)} spellCheck={false} />
              </label>
            ) : null}
          </div>

          <div className="panel split-panel">
            <div>
              <p className="eyebrow">cURL</p>
              <pre>{curlPreview}</pre>
            </div>
            <div>
              <p className="eyebrow">Gateway Response</p>
              <div className="response-meta">
                <span>status: {currentResult.httpStatus ?? '-'}</span>
                <span>latency: {currentResult.latencyMs ?? '-'} ms</span>
              </div>
              <pre>{currentResult.error ? currentResult.error : currentResult.body ? prettyJson(currentResult.body) : 'No response yet.'}</pre>
            </div>
          </div>
        </section>
      </section>

      <section className="knowledge-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Graphify Lab</p>
              <h2>上传文件并手动执行 graphify</h2>
            </div>
            <button className="secondary-button" onClick={loadGraphifyStatus} type="button">
              {graphifyStatusLoading ? 'Loading...' : '刷新状态'}
            </button>
          </div>

          <label className="upload-zone">
            <input
              className="hidden-input"
              type="file"
              multiple
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
            />
            <strong>选择若干文件</strong>
            <span>支持 graphify 可识别的多种格式，例如 PDF、DOCX、XLSX、CSV、TXT、MD、代码文件等。</span>
          </label>

          {selectedFiles.length > 0 ? (
            <div className="file-list">
              {selectedFiles.map((file) => (
                <div key={`${file.name}-${file.size}`} className="file-row">
                  <strong>{file.name}</strong>
                  <span>{formatBytes(file.size)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="action-row">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={replaceExistingUploads}
                onChange={(event) => setReplaceExistingUploads(event.target.checked)}
              />
              <span>上传前清空现有 workspace 内容</span>
            </label>
            <button className="primary-button" onClick={uploadGraphifyFiles} type="button" disabled={selectedFiles.length === 0 || uploading}>
              {uploading ? 'Uploading...' : '上传文件'}
            </button>
            <button className="secondary-button" onClick={runGraphifyBuild} type="button" disabled={runningGraphify || graphifyFiles.length === 0}>
              {runningGraphify ? 'Running...' : '执行 Graphify'}
            </button>
          </div>

          <div className="split-panel">
            <div>
              <p className="eyebrow">Workspace Files</p>
              <div className="file-list tall">
                {graphifyFiles.length === 0 ? <div className="empty-state">还没有导入文件。</div> : null}
                {graphifyFiles.map((file, index) => (
                  <div key={`${file.path ?? file.storedPath ?? file.filename ?? file.name}-${index}`} className="file-row">
                    <strong>{file.filename ?? file.name}</strong>
                    <span>{formatBytes(file.size)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow">Upload / Run / Status Payload</p>
              <pre>{runGraphifyResult ? prettyJson(runGraphifyResult) : uploadResult ? prettyJson(uploadResult) : graphifyStatus ? prettyJson(graphifyStatus) : 'No graphify payload yet.'}</pre>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Knowledge Query</p>
              <h2>基于 graphify 结果继续对话查询</h2>
            </div>
            <button className="primary-button" onClick={queryGraphifyKnowledge} type="button" disabled={querying}>
              {querying ? 'Querying...' : '发起查询'}
            </button>
          </div>

          <label className="editor-block">
            <span>Question</span>
            <textarea value={graphifyQuestion} onChange={(event) => setGraphifyQuestion(event.target.value)} spellCheck={false} className="question-area" />
          </label>

          <div className="split-panel">
            <div>
              <p className="eyebrow">Answer Preview</p>
              <div className="answer-preview">
                {gatewayAnswerPreview || '这里会显示 gateway 基于 graphify 检索上下文生成的最终回答。'}
              </div>
              {graphifyQueryError ? <pre>{graphifyQueryError}</pre> : null}
            </div>
            <div>
              <p className="eyebrow">Raw Query Payload</p>
              <pre>{graphifyQueryResult ? prettyJson(graphifyQueryResult) : 'No query result yet.'}</pre>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
