import { NetworkProtocol, NetworkConnectionState } from './connection.js';
import { TrafficActivity } from './traffic.js';

export type ProcessSignal = 'SIGTERM' | 'SIGKILL';
export type AiConfidenceLevel = 'high' | 'medium' | 'low';
export type AiDetectionSource = 'process-name' | 'executable' | 'known-command' | 'manual';

export interface AiAgentInfo {
  isAiAgent: boolean;
  provider?: string;
  model?: string;
  confidence: AiConfidenceLevel;
  detectionSource: AiDetectionSource;
}

export interface ProcessTreeNode {
  pid: number;
  processName: string;
  ppid: number | null;
  command?: string;
  isAiAgent: boolean;
  aiAgentName?: string;
  trafficIn: number;
  trafficOut: number;
  activeSockets: number;
  children: ProcessTreeNode[];
}

export interface ProcessInspectorDetail {
  pid: number;
  processName: string;
  ppid: number | null;
  executablePath?: string;
  commandLine?: string;
  user?: string;
  arch?: string;
  cpuPercent?: number;
  memoryBytes?: number;
  memoryFormatted?: string;
  firstObserved: string;
  lastObserved: string;
  isAiAgent: boolean;
  aiInfo: AiAgentInfo;
  customLabel?: string;
  isFavorite: boolean;
  tags: string[];
  traffic: {
    currentIn: number;
    currentOut: number;
    peakIn: number;
    peakOut: number;
    totalIn: number;
    totalOut: number;
    historicalAvgIn: number;
    historicalAvgOut: number;
    relativeToAvgMultiplier?: number;
  };
  behaviorIndicators: string[];
  activeConnectionsCount: number;
  uniqueRemoteIps: string[];
  parentProcess?: { pid: number; processName: string } | null;
  childProcesses: Array<{ pid: number; processName: string; activeSockets: number }>;
}

export interface ConnectionInspectorDetail {
  id: string;
  pid: number;
  processName: string;
  protocol: NetworkProtocol;
  localAddress: string;
  localPort: number | null;
  remoteAddress: string | null;
  remotePort: number | null;
  state: NetworkConnectionState;
  firstObserved: string;
  lastObserved: string;
  durationSeconds: number;
  isAiAgent: boolean;
  isBlocked: boolean;
  traffic?: {
    bytesInPerSecond: number;
    bytesOutPerSecond: number;
    activity: TrafficActivity;
  };
  timelineEvents: Array<{
    timestamp: string;
    description: string;
    rateFormatted?: string;
  }>;
  tags: string[];
}

export interface RemoteIpInspectorDetail {
  remoteAddress: string;
  firstObserved: string;
  lastObserved: string;
  totalConnections: number;
  activeConnectionsCount: number;
  isBlocked: boolean;
  associatedProcesses: Array<{
    pid: number;
    processName: string;
    isAiAgent: boolean;
    ports: number[];
    trafficIn: number;
    trafficOut: number;
  }>;
}

export type EventSeverity = 'INFO' | 'WARNING' | 'ERROR';
export type NotificationEventType =
  | 'new_ai_agent'
  | 'high_traffic'
  | 'new_remote_ip'
  | 'blocked_ip_observed'
  | 'process_event'
  | 'firewall_event';

export interface LocalNotificationEvent {
  id: string;
  timestamp: string;
  type: NotificationEventType;
  severity: EventSeverity;
  title: string;
  message: string;
  pid?: number;
  processName?: string;
  remoteIp?: string;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: {
    search?: string;
    isAiAgentOnly?: boolean;
    protocols?: string[];
    states?: string[];
    minTrafficBytesPerSec?: number;
    isBlockedOnly?: boolean;
    isFavoriteOnly?: boolean;
    tags?: string[];
  };
}

export interface UserAppSettings {
  connectionPollingIntervalMs: number;
  trafficAggregationIntervalMs: number;
  historyRecordingEnabled: boolean;
  trafficActiveThresholdBytesPerSec: number;
  highTrafficAlertThresholdMbps: number;
  notificationRules: {
    newAiAgent: boolean;
    highTraffic: boolean;
    newRemoteIp: boolean;
    blockedIpObserved: boolean;
  };
  dashboardLayout: {
    panels: Array<{
      id: string;
      name: string;
      visible: boolean;
      order: number;
    }>;
  };
  compactMode: boolean;
  favoritePids: number[];
  favoriteProcessNames: string[];
  customProcessLabels: Record<string, string>; // processName or pid -> label
  processTags: Record<string, string[]>; // processName or ip -> tags
  filterPresets: FilterPreset[];
}
