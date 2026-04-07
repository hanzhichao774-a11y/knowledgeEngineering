import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],

      addMessage: (msg) =>
        set((state) => ({ messages: [...state.messages, msg] })),

      setMessages: (msgs) => set({ messages: msgs }),

      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: 'ke-chat-store',
      partialize: (state) => ({
        messages: state.messages,
      }),
    },
  ),
);
