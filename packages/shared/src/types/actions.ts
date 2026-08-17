export type PreparedActionType =
  | 'PREPARE_BLOCK_IP'
  | 'PREPARE_KILL_PROCESS'
  | 'CREATE_INVESTIGATION'
  | 'ADD_WATCH_RULE'
  | 'APPLY_NL_FILTER';

export interface PreparedAction {
  id: string;
  actionType: PreparedActionType;
  title: string;
  target: string;
  reason: string;
  impactDescription: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'CONFIRMED' | 'DISMISSED';
  createdAt: string;
}

export type WatchTriggerType = 'NEW_ENDPOINT' | 'HIGH_THROUGHPUT' | 'SOCKET_COUNT';
export type WatchActionType = 'NOTIFY' | 'CREATE_INVESTIGATION' | 'TAG_PROCESS';

export interface WatchRule {
  id: string;
  name: string;
  targetType: 'agent' | 'process';
  targetName: string;
  triggerType: WatchTriggerType;
  threshold?: number;
  action: WatchActionType;
  isEnabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface NaturalLanguageFilter {
  isAiOnly?: boolean;
  minThroughputBytesPerSec?: number;
  minRemoteIpsCount?: number;
  processPattern?: string;
  protocol?: 'TCP' | 'UDP';
  state?: string;
  description: string;
}
