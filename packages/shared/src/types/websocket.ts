import { NetworkConnection } from './connection.js';
import { ProcessTraffic } from './traffic.js';
import { BlockedIp } from './firewall.js';

export type WebSocketClientMessageType =
  | 'ping'
  | 'subscribe'
  | 'unsubscribe';

export type WebSocketServerMessageType =
  | 'pong'
  | 'connection_update'
  | 'traffic_snapshot'
  | 'firewall_event'
  | 'system_status'
  | 'error';

export interface BaseWebSocketMessage<T extends string, P = unknown> {
  type: T;
  payload?: P;
  timestamp: number;
}

export interface PingMessage extends BaseWebSocketMessage<'ping', { nonce?: string }> {}
export interface PongMessage extends BaseWebSocketMessage<'pong', { nonce?: string }> {}

export interface ConnectionUpdateMessage extends BaseWebSocketMessage<'connection_update', {
  connections: NetworkConnection[];
  totalCount: number;
}> {}

export interface TrafficSnapshotMessage extends BaseWebSocketMessage<'traffic_snapshot', {
  timestamp: string;
  totalProcesses: number;
  activeProcesses: number;
  totalBytesInPerSecond: number;
  totalBytesOutPerSecond: number;
  processes: ProcessTraffic[];
}> {}

export interface FirewallEventMessage extends BaseWebSocketMessage<'firewall_event', {
  event: 'ip_blocked' | 'ip_unblocked' | 'block_failed' | 'unblock_failed';
  ip: string;
  timestamp: string;
  message?: string;
  blockedIp?: BlockedIp;
}> {}

export interface SystemStatusMessage extends BaseWebSocketMessage<'system_status', {
  cpuPercent?: number;
  memoryPercent?: number;
  activeSockets: number;
  uptimeSeconds: number;
}> {}

export interface ErrorMessage extends BaseWebSocketMessage<'error', {
  code: string;
  message: string;
}> {}

export type WebSocketClientMessage = PingMessage;
export type WebSocketServerMessage =
  | PongMessage
  | ConnectionUpdateMessage
  | TrafficSnapshotMessage
  | FirewallEventMessage
  | SystemStatusMessage
  | ErrorMessage;
