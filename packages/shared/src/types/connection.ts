import { ConnectionTraffic } from './traffic.js';

export type NetworkProtocol = 'TCP' | 'UDP';

export type NetworkConnectionState =
  | 'LISTEN'
  | 'ESTABLISHED'
  | 'CLOSE_WAIT'
  | 'TIME_WAIT'
  | 'SYN_SENT'
  | 'SYN_RECEIVED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'CLOSING'
  | 'LAST_ACK'
  | 'UNCONNECTED'
  | 'UNKNOWN';

export interface NetworkEndpoint {
  address: string;
  port: number | null;
}

export interface NetworkConnection {
  id: string;
  protocol: NetworkProtocol;
  localAddress: string;
  localPort: number | null;
  remoteAddress: string | null;
  remotePort: number | null;
  state: NetworkConnectionState | string;
  processName: string;
  pid: number;
  user?: string;
  fd?: string;
  ipVersion: 'IPv4' | 'IPv6';
  isListening: boolean;
  command?: string;
  discoveredAt: string;
  traffic?: ConnectionTraffic;
  isAiAgent?: boolean;
  aiAgentName?: string;
  isSelf?: boolean;
  selfRole?: string;
  platform?: string;
}

