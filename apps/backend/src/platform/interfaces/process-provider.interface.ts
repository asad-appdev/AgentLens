import { ProcessSignal, ProcessTreeNode } from '@network-monitor/shared';

export interface RawProcessInfo {
  pid: number;
  ppid: number;
  comm: string;
  args: string;
  executablePath?: string;
}

export interface TerminateProcessResult {
  success: boolean;
  message: string;
  errorCode?: string;
}

export interface IPlatformProcessProvider {
  /**
   * Safely terminates a process by PID with protections against system processes (e.g. PID <= 1 on macOS or PID <= 4 on Windows).
   */
  terminateProcess(pid: number, signal?: ProcessSignal, dryRun?: boolean): Promise<TerminateProcessResult>;

  /**
   * Retrieves raw snapshot of all current system processes and command lines.
   */
  getRawProcessList(): Promise<RawProcessInfo[]>;

  /**
   * Builds parent-child relationship tree for active network processes.
   */
  buildProcessTree(activePids: number[]): Promise<ProcessTreeNode[]>;

  /**
   * Gets parent and direct children for a specific PID.
   */
  getProcessFamily(pid: number): Promise<{
    parent: { pid: number; processName: string } | null;
    children: Array<{ pid: number; processName: string }>;
  }>;
}
