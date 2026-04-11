import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OntologyResult, GraphData, AgentDetail, RightTab, ReportData } from '../types';

export interface CachedTaskResult {
  ontology?: OntologyResult;
  schema?: string;
  summary?: string;
  answer?: string;
}

interface ResultState {
  activeTab: RightTab;
  ontologyResult: OntologyResult | null;
  schemaContent: string | null;
  schemaStatus: 'pending' | 'building' | 'done';
  schemaProgress: number;
  documentSummary: string | null;
  graphData: GraphData | null;
  agentDetail: AgentDetail | null;
  answerContent: string | null;
  answerReport: ReportData | null;
  taskResults: Record<string, CachedTaskResult>;

  setActiveTab: (tab: RightTab) => void;
  setOntologyResult: (result: OntologyResult) => void;
  setSchemaContent: (content: string) => void;
  setSchemaStatus: (status: 'pending' | 'building' | 'done') => void;
  setSchemaProgress: (progress: number) => void;
  setDocumentSummary: (summary: string) => void;
  setGraphData: (data: GraphData) => void;
  setAgentDetail: (detail: AgentDetail) => void;
  setAnswerContent: (content: string | null) => void;
  setAnswerReport: (report: ReportData | null) => void;
  cacheTaskResult: (taskId: string, result: CachedTaskResult) => void;
  clearAll: () => void;
}

export const useResultStore = create<ResultState>()(
  persist(
    (set) => ({
      activeTab: 'result',
      ontologyResult: null,
      schemaContent: null,
      schemaStatus: 'pending',
      schemaProgress: 0,
      documentSummary: null,
      graphData: null,
      agentDetail: null,
      answerContent: null,
      answerReport: null,
      taskResults: {},

      setActiveTab: (tab) => set({ activeTab: tab }),
      setOntologyResult: (result) => set({ ontologyResult: result }),
      setSchemaContent: (content) => set({ schemaContent: content }),
      setSchemaStatus: (status) => set({ schemaStatus: status }),
      setSchemaProgress: (progress) => set({ schemaProgress: progress }),
      setDocumentSummary: (summary) => set({ documentSummary: summary }),
      setGraphData: (data) => set({ graphData: data }),
      setAgentDetail: (detail) => set({ agentDetail: detail }),
      setAnswerContent: (content) => set({ answerContent: content }),
      setAnswerReport: (report) => set({ answerReport: report }),
      cacheTaskResult: (taskId, result) =>
        set((state) => ({
          taskResults: { ...state.taskResults, [taskId]: result },
        })),
      clearAll: () =>
        set({
          activeTab: 'result',
          ontologyResult: null,
          schemaContent: null,
          schemaStatus: 'pending',
          schemaProgress: 0,
          documentSummary: null,
          graphData: null,
          agentDetail: null,
          answerContent: null,
          answerReport: null,
          taskResults: {},
        }),
    }),
    {
      name: 'ke-result-store',
      partialize: (state) => ({
        activeTab: state.activeTab,
        ontologyResult: state.ontologyResult,
        schemaContent: state.schemaContent,
        schemaStatus: state.schemaStatus,
        schemaProgress: state.schemaProgress,
        documentSummary: state.documentSummary,
        graphData: state.graphData,
        agentDetail: state.agentDetail,
        answerContent: state.answerContent,
        answerReport: state.answerReport,
        taskResults: state.taskResults,
      }),
    },
  ),
);
