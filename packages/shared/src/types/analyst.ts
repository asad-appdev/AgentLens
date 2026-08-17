export type AnalystProviderType = 'disabled' | 'ollama' | 'openai' | 'fallback';

export interface AnalystActionSuggestion {
  label: string;
  actionType: 'view_agent' | 'view_process' | 'view_ip' | 'filter_traffic' | 'open_investigation';
  target: string;
}

export interface AnalystContextSummary {
  activeSocketsCount: number;
  totalDownloadRate: number;
  totalUploadRate: number;
  activeAiAgents: string[];
  topProcesses: Array<{
    name: string;
    pid: number;
    downloadRate: number;
    uploadRate: number;
  }>;
  recentNewEndpoints: string[];
  behaviorIndicatorsCount: number;
}

export interface AnalystMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedActions?: AnalystActionSuggestion[];
  contextSnapshot?: AnalystContextSummary;
  modelUsed?: string;
}

export interface AnalystConfig {
  provider: AnalystProviderType;
  ollamaEndpoint: string;
  ollamaModel: string;
  openaiApiKey?: string;
  openaiModel?: string;
  temperature?: number;
}

export interface AnalystQueryRequest {
  query: string;
  history?: AnalystMessage[];
}

export interface AnalystQueryResponse {
  reply: AnalystMessage;
  providerUsed: AnalystProviderType;
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  modifiedAt: string;
}
