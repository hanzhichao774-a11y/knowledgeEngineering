import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OntologyResult, GraphData, AgentDetail, RightTab } from '../types';

interface ResultState {
  activeTab: RightTab;
  ontologyResult: OntologyResult | null;
  schemaContent: string | null;
  schemaStatus: 'pending' | 'building' | 'done';
  schemaProgress: number;
  documentSummary: string | null;
  graphData: GraphData | null;
  agentDetail: AgentDetail | null;

  setActiveTab: (tab: RightTab) => void;
  setOntologyResult: (result: OntologyResult) => void;
  setSchemaContent: (content: string) => void;
  setSchemaStatus: (status: 'pending' | 'building' | 'done') => void;
  setSchemaProgress: (progress: number) => void;
  setDocumentSummary: (summary: string) => void;
  setGraphData: (data: GraphData) => void;
  setAgentDetail: (detail: AgentDetail) => void;
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

      setActiveTab: (tab) => set({ activeTab: tab }),
      setOntologyResult: (result) => set({ ontologyResult: result }),
      setSchemaContent: (content) => set({ schemaContent: content }),
      setSchemaStatus: (status) => set({ schemaStatus: status }),
      setSchemaProgress: (progress) => set({ schemaProgress: progress }),
      setDocumentSummary: (summary) => set({ documentSummary: summary }),
      setGraphData: (data) => set({ graphData: data }),
      setAgentDetail: (detail) => set({ agentDetail: detail }),
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
      }),
    },
  ),
);
