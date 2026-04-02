import { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { MessageBubble } from './MessageBubble';
import styles from './CenterPanel.module.css';

export function ChatArea() {
  const messages = useChatStore((s) => s.messages);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={styles.chatArea}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
