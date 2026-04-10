import { useEffect, useRef, useMemo } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useTaskStore } from '../../store/taskStore';
import { MessageBubble } from './MessageBubble';
import { AgentNode } from './AgentNode';
import type { ChatMessage } from '../../types';
import styles from './CenterPanel.module.css';

interface TreeNode {
  msg: ChatMessage;
  children: ChatMessage[];
}

function buildMessageTree(messages: ChatMessage[]): (TreeNode | ChatMessage)[] {
  const managerMap = new Map<string, TreeNode>();
  const result: (TreeNode | ChatMessage)[] = [];

  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
      result.push(msg);
      continue;
    }

    if (msg.role === 'manager') {
      const node: TreeNode = { msg, children: [] };
      managerMap.set(msg.id, node);
      result.push(node);
      continue;
    }

    if (msg.parentId && managerMap.has(msg.parentId)) {
      managerMap.get(msg.parentId)!.children.push(msg);
    } else {
      const lastNode = [...result].reverse().find(
        (item): item is TreeNode => 'children' in item,
      );
      if (lastNode) {
        lastNode.children.push(msg);
      } else {
        result.push(msg);
      }
    }
  }

  return result;
}

function isTreeNode(item: TreeNode | ChatMessage): item is TreeNode {
  return 'children' in item && 'msg' in item;
}

export function ChatArea() {
  const messages = useChatStore((s) => s.messages);
  const activeTask = useTaskStore((s) => s.tasks.find((t) => t.status === 'running'));
  const endRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildMessageTree(messages), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={styles.chatArea}>
      {tree.map((item, idx) => {
        if (isTreeNode(item)) {
          const isLastTree = !tree.slice(idx + 1).some(isTreeNode);
          return (
            <AgentNode
              key={item.msg.id}
              msg={item.msg}
              children={item.children}
              isRunning={!!activeTask && isLastTree}
            />
          );
        }

        return <MessageBubble key={item.id} msg={item} />;
      })}
      <div ref={endRef} />
    </div>
  );
}
