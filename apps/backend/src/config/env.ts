import dotenv from 'dotenv';
import { DEFAULT_HOST, DEFAULT_PORT } from '@network-monitor/shared';

// Load environment variables from .env if present
dotenv.config();

export interface ServerConfig {
  host: string;
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  wsHeartbeatIntervalMs: number;
  connectionPollIntervalMs: number;
  dryRunMode: boolean;
  allowPrivilegedOperations: boolean;
}

function validateAndGetConfig(): ServerConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  
  let host = process.env.HOST || DEFAULT_HOST;
  // Security Enforcement: Backend MUST strictly bind to 127.0.0.1 or localhost loopback
  if (host === '0.0.0.0' || host === '::' || host === '') {
    console.warn(`[SECURITY WARNING] Attempted to bind to insecure host '${host}'. Forcing strict 127.0.0.1 loopback binding.`);
    host = DEFAULT_HOST;
  }

  const rawPort = process.env.PORT;
  const port = rawPort ? parseInt(rawPort, 10) : DEFAULT_PORT;
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT specified in environment: ${rawPort}`);
  }

  const wsHeartbeatIntervalMs = parseInt(process.env.WS_HEARTBEAT_INTERVAL_MS || '15000', 10);
  const connectionPollIntervalMs = parseInt(process.env.CONNECTION_POLL_INTERVAL_MS || '2000', 10);
  const dryRunMode = process.env.ENABLE_DRY_RUN_MODE !== 'false';
  const allowPrivilegedOperations = process.env.ALLOW_PRIVILEGED_OPERATIONS === 'true';

  return {
    host,
    port,
    nodeEnv,
    wsHeartbeatIntervalMs: isNaN(wsHeartbeatIntervalMs) ? 15000 : wsHeartbeatIntervalMs,
    connectionPollIntervalMs: isNaN(connectionPollIntervalMs) ? 2000 : connectionPollIntervalMs,
    dryRunMode,
    allowPrivilegedOperations,
  };
}

export const config: ServerConfig = validateAndGetConfig();
