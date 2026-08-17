import { NetworkProtocol, NetworkConnectionState } from './connection.js';

export type HistoryTimeRange = '5m' | '30m' | '1h' | '6h' | '24h' | '7d' | 'all';

export interface ProcessHistoryRecord {
  id?: number;
  timestamp: string;
  pid: number;
  processName: string;
  command?: string;
  cpuPercent?: number;
  memoryBytes?: number;
  isAiAgent: boolean;
  aiAgentName?: string;
  createdAt: number;
}

export interface ConnectionHistoryRecord {
  id?: number;
  timestamp: string;
  pid: number;
  processName: string;
  protocol: NetworkProtocol | string;
  localAddress?: string;
  localPort?: number | null;
  remoteAddress?: string | null;
  remotePort?: number | null;
  state?: NetworkConnectionState | string;
  isAiAgent: boolean;
  aiAgentName?: string;
  createdAt: number;
}

export interface TrafficHistoryRecord {
  id?: number;
  timestamp: string;
  pid: number;
  processName: string;
  bytesInPerSecond: number;
  bytesOutPerSecond: number;
  totalBytesPerSecond: number;
  isAiAgent: boolean;
  aiAgentName?: string;
  createdAt: number;
}

export interface TrafficTimelineBucket {
  timestamp: string;
  timeEpochMs: number;
  bytesInRate: number;
  bytesOutRate: number;
  totalRate: number;
  activeProcesses: number;
}

export interface TopProcessStat {
  processName: string;
  pid: number;
  isAiAgent: boolean;
  aiAgentName?: string;
  totalBytesIn: number;
  totalBytesOut: number;
  totalBytes: number;
  peakRate: number;
  firstSeen: string;
  lastSeen: string;
  connectionCount: number;
}

export interface TopRemoteIpStat {
  remoteAddress: string;
  connectionsCount: number;
  firstSeen: string;
  lastSeen: string;
  associatedProcesses: string[];
  isBlocked: boolean;
}

export interface ProcessDetailHistory {
  pid: number;
  processName: string;
  isAiAgent: boolean;
  aiAgentName?: string;
  firstSeen: string;
  lastSeen: string;
  totalObservations: number;
  uniqueRemoteIps: string[];
  uniqueRemotePorts: number[];
  totalDownloadedBytes: number;
  totalUploadedBytes: number;
  peakDownloadRate: number;
  peakUploadRate: number;
  recentConnections: ConnectionHistoryRecord[];
  trafficTimeline: TrafficTimelineBucket[];
}

export interface HistorySummary {
  from: string;
  to: string;
  totalDownloaded: number;
  totalUploaded: number;
  peakDownload: number;
  peakUpload: number;
  averageDownload: number;
  averageUpload: number;
  topProcesses: TopProcessStat[];
  topAiAgents: TopProcessStat[];
  uniqueRemoteIps: number;
  totalRecordedConnections: number;
}

export interface GroupedProcessConnections {
  processName: string;
  pid: number;
  isAiAgent: boolean;
  aiAgentName?: string;
  totalBytesInPerSecond: number;
  totalBytesOutPerSecond: number;
  activeSocketsCount: number;
  endpoints: Array<{
    protocol: string;
    localPort: number | null;
    remoteAddress: string | null;
    remotePort: number | null;
    state: string;
    isBlocked: boolean;
  }>;
}

export interface HistoryStatus {
  isAvailable: boolean;
  isRecording: boolean;
  databaseSizeBytes: number;
  databaseSizeFormatted: string;
  retentionDays: number;
  totalProcessRecords: number;
  totalConnectionRecords: number;
  totalTrafficRecords: number;
  oldestRecordTimestamp?: string;
  newestRecordTimestamp?: string;
}

export interface ExportHistoryPayload {
  exportedAt: string;
  version: number;
  schemaVersion: string;
  timeRange: {
    from: string;
    to: string;
  };
  summary?: HistorySummary;
  processes?: ProcessHistoryRecord[];
  connections?: ConnectionHistoryRecord[];
  traffic?: TrafficHistoryRecord[];
  firewallEvents?: any[];
}
