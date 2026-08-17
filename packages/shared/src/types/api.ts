import { NetworkConnection } from './connection.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime: number;
  timestamp: string;
  environment: string;
  platform: string;
  arch: string;
}

export interface ConnectionsResponse {
  timestamp: string;
  total: number;
  connections: NetworkConnection[];
}
