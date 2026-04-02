import { useEffect } from 'react';
import { AppShell } from './components/Layout/AppShell';
import { LeftPanel } from './components/LeftPanel';
import { CenterPanel } from './components/CenterPanel';
import { RightPanel } from './components/RightPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useTaskStore } from './store/taskStore';
import { useChatStore } from './store/chatStore';
import { useResultStore } from './store/resultStore';
import { getWsUrl, fetchTaskResult, fetchGraphData } from './services/api';
import { useMockFlow } from './hooks/useMockFlow';
import './styles/global.css';

function useIsMockMode() {
  return new URLSearchParams(window.location.search).has('mock');
}

export default function App() {
  const isMock = useIsMockMode();
  const { initialize } = useMockFlow();

  useEffect(() => {
    if (isMock) initialize();
  }, [isMock, initialize]);

  useWebSocket(isMock ? '' : getWsUrl(), (event) => {
    if (isMock) return;
    handleWSEvent(event);
  });

  return (
    <AppShell
      left={<LeftPanel />}
      center={<CenterPanel isMock={isMock} />}
      right={<RightPanel />}
    />
  );
}

function handleWSEvent(event: Record<string, unknown>) {
  const type = event.type as string;
  const taskStore = useTaskStore.getState();
  const chatStore = useChatStore.getState();
  const resultStore = useResultStore.getState();

  switch (type) {
    case 'task.created': {
      const task = event.task as Parameters<typeof taskStore.addTask>[0];
      taskStore.addTask(task);
      taskStore.setActiveTask(task.id);
      break;
    }

    case 'task.status': {
      const taskId = event.taskId as string;
      const status = event.status as 'queued' | 'running' | 'completed' | 'failed';
      taskStore.updateTaskStatus(taskId, status);
      break;
    }

    case 'task.step.start': {
      const taskId = event.taskId as string;
      const stepIndex = event.stepIndex as number;
      taskStore.updateStep(taskId, stepIndex, { status: 'running' });
      break;
    }

    case 'task.step.complete': {
      const taskId = event.taskId as string;
      const stepIndex = event.stepIndex as number;
      const step = event.step as Record<string, unknown>;
      const cost = event.cost as Parameters<typeof taskStore.updateCost>[1];

      taskStore.updateStep(taskId, stepIndex, {
        status: (step.status as 'done' | 'error' | 'skipped') ?? 'done',
        tokenUsed: (step.tokenUsed as number) ?? 0,
        duration: step.duration as number | undefined,
      });
      if (cost) taskStore.updateCost(taskId, cost);
      break;
    }

    case 'task.complete': {
      const taskId = event.taskId as string;
      const finalStatus = (event.status as 'completed' | 'failed') ?? 'completed';
      taskStore.updateTaskStatus(taskId, finalStatus);

      fetchTaskResult(taskId).then((result) => {
        if (result && !result.error) {
          if (result.ontology) resultStore.setOntologyResult(result.ontology);
          if (result.schema) {
            resultStore.setSchemaContent(escapeSchemaHtml(result.schema));
            resultStore.setSchemaStatus('done');
            resultStore.setSchemaProgress(100);
          }
          if (result.summary) resultStore.setDocumentSummary(result.summary);
        }
      });

      fetchGraphData(taskId).then((graphData) => {
        if (graphData && !graphData.error) {
          resultStore.setGraphData(graphData);
        }
      });
      break;
    }

    case 'agent.message': {
      const message = event.message as Parameters<typeof chatStore.addMessage>[0];
      chatStore.addMessage(message);

      if (message.agentStatus) {
        const activeTask = taskStore.getActiveTask();
        if (activeTask) {
          const step = message.agentStatus;
          resultStore.setAgentDetail({
            id: 'KE-01',
            name: '知识工程数字员工 #KE-01',
            description: '知识工程工作线 · 实例 01',
            inputTokens: step.tokenUsed ?? 0,
            outputTokens: Math.floor((step.tokenUsed ?? 0) * 0.4),
            elapsed: activeTask.cost.elapsed,
            currentStep: activeTask.steps.filter((s) => s.status === 'done').length + 1,
            totalSteps: 5,
            skills: activeTask.steps.map((s) => ({
              name: s.skill,
              icon: s.skillIcon,
              status: s.status === 'done' ? 'done' as const
                : s.status === 'running' ? 'running' as const
                : s.status === 'error' ? 'done' as const
                : 'idle' as const,
            })),
          });
        }
      }
      break;
    }
  }
}

function escapeSchemaHtml(schema: string): string {
  return schema
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/ {2}/g, '&nbsp;&nbsp;');
}
