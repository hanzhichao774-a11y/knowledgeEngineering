import { useState } from 'react';
import { ChatArea } from './ChatArea';
import { InputArea } from './InputArea';
import { useChatStore } from '../../store/chatStore';
import { createTask, uploadFile } from '../../services/api';
import type { ChatMessage } from '../../types';

interface CenterPanelProps {
  isMock?: boolean;
}

export function CenterPanel({ isMock }: CenterPanelProps) {
  const addMessage = useChatStore((s) => s.addMessage);
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async (text: string) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      name: '张闯',
      content: `<p>${text}</p>`,
      timestamp: new Date().toTimeString().slice(0, 5),
    };
    addMessage(msg);

    if (isMock) return;

    setIsProcessing(true);
    try {
      await createTask(text, text, pendingFileId ?? undefined);
      setPendingFileId(null);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      name: '张闯',
      content: `<p>请帮我处理这份文档，提取其中的关键概念、规则和关系，构建知识图谱。</p>`,
      timestamp: new Date().toTimeString().slice(0, 5),
      attachment: {
        name: file.name,
        size: `${sizeMB} MB`,
      },
    };
    addMessage(msg);

    if (isMock) return;

    setIsProcessing(true);
    try {
      const { fileId } = await uploadFile(file);
      await createTask(
        file.name,
        '提取关键概念、规则和关系，构建知识图谱',
        fileId
      );
      setPendingFileId(null);
    } catch (err) {
      console.error('Failed to upload/create task:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <ChatArea />
      <InputArea
        onSend={handleSend}
        onFileUpload={handleFileUpload}
        disabled={isProcessing}
      />
    </>
  );
}
