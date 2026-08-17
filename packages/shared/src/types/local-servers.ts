export type DevServerType =
  | 'Vite'
  | 'Next.js'
  | 'React (CRA)'
  | 'Node.js / Express'
  | 'Node.js / Fastify'
  | 'Node.js / NestJS'
  | 'Python / FastAPI'
  | 'Python / Flask'
  | 'Python / Django'
  | 'Python / Uvicorn'
  | 'Go Server'
  | 'Rust Server'
  | 'Ruby / Rails'
  | 'PHP / Laravel'
  | 'Flutter'
  | 'Ollama'
  | 'PostgreSQL'
  | 'MySQL'
  | 'Redis'
  | 'Docker'
  | 'Generic Server';

export interface LocalServerInfo {
  pid: number;
  processName: string;
  port: number;
  localAddress: string;
  protocol: 'TCP' | 'UDP';
  state: string;
  commandLine?: string;
  ppid?: number;
  parentProcessName?: string;
  serverType: DevServerType;
  isDevServer: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  detectionReason: string;
  isSelf?: boolean;
  selfRole?: string;
  cwd?: string;
  firstSeenAt?: string;
}

export interface KillPortRequest {
  port: number;
  protocol?: 'TCP' | 'UDP';
  signal?: 'SIGTERM' | 'SIGKILL';
  expectedPid?: number;
}

export interface KillPortResult {
  port: number;
  pid: number;
  processName: string;
  serverType?: DevServerType;
  signalUsed: 'SIGTERM' | 'SIGKILL';
  success: boolean;
  portReleased: boolean;
  error?: string;
}

export interface KillProcessesRequest {
  pids?: number[];
  ports?: number[];
  signal?: 'SIGTERM' | 'SIGKILL';
}

export interface KillProcessesResponse {
  results: KillPortResult[];
  allSuccessful: boolean;
  portsReleasedCount: number;
}
