import { ChatArea } from './ChatArea';
import { InputArea } from './InputArea';
import { useChatStore } from '../../store/chatStore';
import type { ChatMessage } from '../../types';

export function CenterPanel() {
  const addMessage = useChatStore((s) => s.addMessage);

  const handleSend = (text: string) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      name: '张闯',
      content: `<p>${text}</p>`,
      timestamp: new Date().toTimeString().slice(0, 5),
    };
    addMessage(msg);
  };

  const handleFileUpload = (file: File) => {
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
  };

  return (
    <>
      <ChatArea />
      <InputArea onSend={handleSend} onFileUpload={handleFileUpload} />
    </>
  );
}
