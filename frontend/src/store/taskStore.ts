import { create } from 'zustand';
import type { Task, CostInfo, Step } from '../types';

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  setActiveTask: (id: string) => void;
  addTask: (task: Task) => void;
  updateStep: (taskId: string, stepIndex: number, updates: Partial<Step>) => void;
  updateCost: (taskId: string, cost: CostInfo) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  getActiveTask: () => Task | undefined;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  activeTaskId: null,

  setActiveTask: (id) => set({ activeTaskId: id }),

  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),

  updateStep: (taskId, stepIndex, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              steps: t.steps.map((s, i) =>
                i === stepIndex ? { ...s, ...updates } : s
              ),
            }
          : t
      ),
    })),

  updateCost: (taskId, cost) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, cost } : t
      ),
    })),

  updateTaskStatus: (taskId, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status } : t
      ),
    })),

  getActiveTask: () => {
    const { tasks, activeTaskId } = get();
    return tasks.find((t) => t.id === activeTaskId);
  },
}));
