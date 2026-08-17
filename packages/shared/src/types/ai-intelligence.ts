import { NetworkProtocol } from './connection.js';

export type AiAgentCategory = 'local-runtime' | 'cli-agent' | 'ide-assistant' | 'web-ui' | 'custom';
export type AiConfidenceGrade = 'HIGH' | 'MEDIUM' | 'LOW' | 'MANUAL';
export type AiDetectionSourceType =
  | 'process-name'
  | 'executable'
  | 'command-pattern'
  | 'known-port'
  | 'parent-process'
  | 'manual';

export interface AiAgentDefinition {
  id: string;
  displayName: string;
  category: AiAgentCategory;
  processNames: string[];
  executableNames?: string[];
  commandPatterns?: string[];
  knownPorts?: number[];
  description: string;
}

export interface AiAgentDetectionResult {
  agentId: string;
  displayName: string;
  category: AiAgentCategory;
  confidence: AiConfidenceGrade;
  confidenceScore: number; // 0.0 - 1.0
  evidence: string[];
  detectionSources: AiDetectionSourceType[];
  isLocalServer: boolean;
  listeningPort?: number;
  matchedPid: number;
  processName: string;
  executablePath?: string;
  commandLine?: string;
}


export type AiSessionStatus = 'NOT_STARTED' | 'ACTIVE' | 'IDLE' | 'ENDED';

export interface AiAgentSession {
  sessionId: string;
  agentId: string;
  displayName: string;
  rootPid: number;
  status: AiSessionStatus;
  startTime: string;
  lastSeen: string;
  endTime?: string;
  bytesIn: number;
  bytesOut: number;
  connectionCount: number;
  uniqueRemoteIps: string[];
  childPids: number[];
}

export interface AiAgentProfile {
  agentId: string;
  displayName: string;
  category: AiAgentCategory;
  status: 'ACTIVE' | 'IDLE' | 'NOT_OBSERVED' | 'UNKNOWN';
  confidence: AiConfidenceGrade;
  detectionSources: AiDetectionSourceType[];
  processCount: number;
  activeSessionsCount: number;
  connectionsCount: number;
  remoteHostsCount: number;
  downloadBytes: number;
  uploadBytes: number;
  currentDownloadRate: number;
  currentUploadRate: number;
  runtimeMinutes: number;
  observedStart: string;
  lastObserved: string;
  isLocalService: boolean;
  listeningPorts: number[];
  pids: number[];
  recentEndpoints: Array<{
    ip: string;
    port: number;
    protocol: NetworkProtocol;
    bytes: number;
    lastSeen: string;
  }>;
}

export interface NetworkRelationshipGraphNode {
  id: string;
  label: string;
  type: 'agent' | 'process' | 'socket' | 'endpoint';
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface NetworkRelationshipGraphEdge {
  source: string;
  target: string;
  label: string; // 'owns' | 'uses' | 'connects-to' | 'communicates-with'
}

export interface NetworkRelationshipGraphData {
  nodes: NetworkRelationshipGraphNode[];
  edges: NetworkRelationshipGraphEdge[];
}

export type BehaviorIndicatorType =
  | 'HIGH_TRAFFIC'
  | 'NEW_ENDPOINT'
  | 'HIGH_CONNECTION_COUNT'
  | 'UNUSUAL_PORT'
  | 'LONG_SESSION'
  | 'HIGH_UPLOAD'
  | 'HIGH_DOWNLOAD';

export interface BehaviorIndicator {
  id: string;
  type: BehaviorIndicatorType;
  entityId: string; // processName or agentId
  entityType: 'agent' | 'process';
  label: string;
  explanation: string;
  currentValue: string;
  baselineValue: string;
  multiplier?: number;
  timestamp: string;
}

export interface HistoricalBaseline {
  entityId: string; // processName or agentId
  entityType: 'agent' | 'process';
  typicalConnectionCount: number;
  typicalRemoteHostCount: number;
  typicalUploadRate: number;
  typicalDownloadRate: number;
  typicalPorts: number[];
  samplesCount: number;
  firstRecorded: string;
  lastUpdated: string;
  isAvailable: boolean;
}

export interface SmartFirewallSuggestion {
  id: string;
  agentId?: string;
  processName: string;
  pid: number;
  remoteIp: string;
  remotePort: number;
  reason: string;
  timestamp: string;
  status: 'PENDING' | 'IGNORED' | 'INSPECTED' | 'BLOCKED';
}

export interface InvestigationItem {
  id: string;
  type: 'agent' | 'process' | 'connection' | 'endpoint' | 'event';
  targetId: string;
  title: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface InvestigationNote {
  id: string;
  text: string;
  timestamp: string;
}

export interface InvestigationWorkspace {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  items: InvestigationItem[];
  notes: InvestigationNote[];
  timeline: Array<{
    timestamp: string;
    eventType: string;
    description: string;
    severity?: string;
  }>;
}

export interface AiAgentComparisonStat {
  agentId: string;
  displayName: string;
  runtimeMinutes: number;
  connectionsCount: number;
  downloadBytes: number;
  uploadBytes: number;
  remoteHostsCount: number;
  activeProcesses: number;
}
