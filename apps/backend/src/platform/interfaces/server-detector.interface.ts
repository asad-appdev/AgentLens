import {
  LocalServerInfo,
  KillPortRequest,
  KillPortResult,
  KillProcessesRequest,
  KillProcessesResponse,
} from '@network-monitor/shared';

export interface IPlatformServerDetector {
  /**
   * Discovers all active local listening servers and identifies their server/framework type.
   */
  discoverLocalServers(): Promise<LocalServerInfo[]>;

  /**
   * Resolves the PID listening on the given port and terminates the process safely after verification.
   */
  killPort(req: KillPortRequest): Promise<KillPortResult>;

  /**
   * Batch terminates multiple selected processes or ports with post-cleanup release verification.
   */
  killProcesses(req: KillProcessesRequest): Promise<KillProcessesResponse>;
}
