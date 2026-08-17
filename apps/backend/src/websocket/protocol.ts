import { WebSocketServerMessage, TrafficSummary } from '@network-monitor/shared';

/**
 * Creates a standard JSON string for WebSocket server messages.
 */
export function formatWsMessage<T extends WebSocketServerMessage>(msg: T): string {
  return JSON.stringify(msg);
}

/**
 * Creates a standard Pong message response.
 */
export function createPongMessage(nonce?: string): WebSocketServerMessage {
  return {
    type: 'pong',
    payload: { nonce },
    timestamp: Date.now(),
  };
}

/**
 * Creates a standard Connection Update message.
 */
export function createConnectionUpdateMessage(connections: any[] = []): WebSocketServerMessage {
  return {
    type: 'connection_update',
    payload: {
      connections,
      totalCount: connections.length,
    },
    timestamp: Date.now(),
  };
}

/**
 * Creates a standard Traffic Snapshot message.
 */
export function createTrafficSnapshotMessage(summary: TrafficSummary): WebSocketServerMessage {
  return {
    type: 'traffic_snapshot',
    payload: {
      timestamp: summary.timestamp,
      totalProcesses: summary.totalProcesses,
      activeProcesses: summary.activeProcesses,
      totalBytesInPerSecond: summary.totalBytesInPerSecond,
      totalBytesOutPerSecond: summary.totalBytesOutPerSecond,
      processes: summary.processes,
    },
    timestamp: Date.now(),
  };
}

/**
 * Creates a standard Error message.
 */
export function createErrorMessage(code: string, message: string): WebSocketServerMessage {
  return {
    type: 'error',
    payload: { code, message },
    timestamp: Date.now(),
  };
}
