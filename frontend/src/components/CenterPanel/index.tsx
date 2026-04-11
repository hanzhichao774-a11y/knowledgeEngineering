import { useState, useCallback } from 'react';
import { TaskHeader } from './TaskHeader';
import { ChatArea } from './ChatArea';
import { DashboardView } from './DashboardView';
import { InputArea } from './InputArea';
import { useChatStore } from '../../store/chatStore';
import { useTaskStore } from '../../store/taskStore';
import { createTask, uploadFile } from '../../services/api';
import { MOCK_REPORT, REPORT_STEPS } from '../../constants/reportMockData';
import type { ChatMessage, FileAttachment } from '../../types';

interface CenterPanelProps {
  isMock?: boolean;
}

const REPORT_KEYWORDS = ['生成报告', '报告生成', '分析报告', '月度报告', '运行报告', '能耗报告'];

function isReportCommand(text: string): boolean {
  return REPORT_KEYWORDS.some((kw) => text.includes(kw));
}

export function CenterPanel({ isMock }: CenterPanelProps) {
  const addMessage = useChatStore((s) => s.addMessage);
  const messages = useChatStore((s) => s.messages);
  const activeTask = useTaskStore((s) => s.tasks.find((t) => t.status === 'running'));
  const [isProcessing, setIsProcessing] = useState(false);

  const isIdle = messages.length === 0 && !activeTask;

  const runReportFlow = useCallback(async () => {
    setIsProcessing(true);

    addMessage({
      id: `sys-report-start-${Date.now()}`,
      role: 'manager',
      name: '管理智能体',
      content: '<p>📋 收到报告生成指令，启动自动报告生成流程...</p>',
      timestamp: new Date().toTimeString().slice(0, 5),
    });

    for (let i = 0; i < REPORT_STEPS.length; i++) {
      const step = REPORT_STEPS[i];
      addMessage({
        id: `sys-report-step-${i}-${Date.now()}`,
        role: 'worker',
        name: '报告生成 #RG-01',
        content: `<p>⏳ Step ${i + 1}/${REPORT_STEPS.length}: ${step.name} — ${step.desc}</p>`,
        timestamp: new Date().toTimeString().slice(0, 5),
        agentStatus: {
          skill: step.name,
          skillIcon: '📊',
          tokenUsed: 0,
          tokenLimit: 8000,
          status: 'running',
        },
      });
      await new Promise((r) => setTimeout(r, step.duration));
    }

    addMessage({
      id: `sys-report-done-${Date.now()}`,
      role: 'assistant',
      name: '知识助手',
      content: '报告已生成，以下是分析结果：',
      timestamp: new Date().toTimeString().slice(0, 5),
      report: MOCK_REPORT,
    });

    setIsProcessing(false);
  }, [addMessage]);

  const handleSend = async (text: string) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      name: '张闯',
      content: `<p>${text}</p>`,
      timestamp: new Date().toTimeString().slice(0, 5),
    };
    addMessage(msg);

    if (isReportCommand(text)) {
      await runReportFlow();
      return;
    }

    if (isMock) return;

    setIsProcessing(true);
    try {
      await createTask(text, text);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    const attachments: FileAttachment[] = files.map((f) => ({
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
    }));

    const fileLabel =
      files.length === 1
        ? `这份文档`
        : `这 ${files.length} 份文档`;

    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      name: '张闯',
      content: `<p>请帮我处理${fileLabel}，提取其中的关键概念、规则和关系，构建知识图谱。</p>`,
      timestamp: new Date().toTimeString().slice(0, 5),
      attachments,
      attachment: attachments[0],
    };
    addMessage(msg);

    if (isMock) return;

    setIsProcessing(true);
    try {
      const fileIds: string[] = [];
      for (const file of files) {
        const { fileId } = await uploadFile(file);
        fileIds.push(fileId);
      }

      const title =
        files.length === 1
          ? files[0].name
          : `${files.length} 份文档批量处理`;

      await createTask(
        title,
        '提取关键概念、规则和关系，构建知识图谱',
        fileIds
      );
    } catch (err) {
      console.error('Failed to upload/create task:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <TaskHeader />
      {isIdle ? <DashboardView /> : <ChatArea />}
      <InputArea
        onSend={handleSend}
        onFileUpload={handleFileUpload}
        disabled={isProcessing}
      />
    </>
  );
}
