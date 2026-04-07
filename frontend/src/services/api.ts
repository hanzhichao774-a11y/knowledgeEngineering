import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchTasks() {
  const { data } = await api.get('/tasks');
  return data;
}

export async function createTask(title: string, description?: string, fileId?: string) {
  const { data } = await api.post('/tasks', { title, description, fileId });
  return data;
}

export async function fetchTask(id: string) {
  const { data } = await api.get(`/tasks/${id}`);
  return data;
}

export async function fetchTaskResult(id: string) {
  const { data } = await api.get(`/tasks/${id}/result`);
  return data;
}

export async function fetchGraphData(taskId: string) {
  const { data } = await api.get(`/graph/${taskId}`);
  return data;
}

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function sendChat(taskId: string, content: string) {
  const { data } = await api.post('/chat', { taskId, content });
  return data;
}

export async function fetchKnowledgeStatus() {
  const { data } = await api.get('/knowledge/status');
  return data as { connected: boolean; nodeCount: number; edgeCount: number };
}

export async function fetchNeo4jGraph() {
  const { data } = await api.get('/graph/neo4j/all');
  return data;
}

export function getWsUrl() {
  const base = BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws`;
}
