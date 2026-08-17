export type TrafficActivity = 'ACTIVE' | 'IDLE' | 'UNKNOWN';

export type TrafficMeasurementScope = 'PROCESS';

export interface ConnectionTraffic {
  bytesInPerSecond: number;
  bytesOutPerSecond: number;
  totalBytesPerSecond: number;
  activity: TrafficActivity;
  scope: TrafficMeasurementScope;
}

export interface TrafficHistoryPoint {
  timestamp: number;
  bytesInPerSecond: number;
  bytesOutPerSecond: number;
}

export interface ProcessTraffic {
  pid: number;
  processName: string;
  bytesIn: number;
  bytesOut: number;
  bytesInPerSecond: number;
  bytesOutPerSecond: number;
  totalBytesPerSecond: number;
  activity: TrafficActivity;
  isAiAgent?: boolean;
  aiAgentName?: string;
  modelName?: string;
  lastUpdated: number;
  history?: TrafficHistoryPoint[];
}

export interface TrafficSummary {
  timestamp: string;
  totalProcesses: number;
  activeProcesses: number;
  totalBytesInPerSecond: number;
  totalBytesOutPerSecond: number;
  processes: ProcessTraffic[];
}
