import type { ProcessSignal, ProcessTreeNode } from '@network-monitor/shared';
import type { IPlatformProcessProvider, RawProcessInfo, TerminateProcessResult } from '../interfaces/process-provider.interface.js';

import { CommandRunnerService, commandRunner } from '../../services/command-runner.service.js';

export class MacProcessProvider implements IPlatformProcessProvider {
  constructor(private readonly runner: CommandRunnerService = commandRunner) {}

  public async terminateProcess(
    pid: number,
    signal: ProcessSignal = 'SIGTERM',
    dryRun = false
  ): Promise<TerminateProcessResult> {
    if (pid <= 1) {
      return {
        success: false,
        message: `Safety violation: Refusing to terminate system process PID ${pid}.`,
        errorCode: 'PROTECTED_PROCESS',
      };
    }

    if (dryRun) {
      return {
        success: true,
        message: `[Dry Run] Simulated sending ${signal} to PID ${pid}.`,
      };
    }

    try {
      process.kill(pid, signal);
      return {
        success: true,
        message: `Successfully sent ${signal} to PID ${pid}.`,
      };
    } catch (error: any) {
      if (error.code === 'ESRCH') {
        return {
          success: true,
          message: `Process PID ${pid} was already terminated.`,
        };
      } else if (error.code === 'EPERM') {
        return {
          success: false,
          message: `Permission denied: Insufficient privileges to terminate PID ${pid}.`,
          errorCode: 'INSUFFICIENT_PRIVILEGES',
        };
      } else {
        return {
          success: false,
          message: error.message || `Failed to send ${signal} to PID ${pid}.`,
          errorCode: 'TERMINATION_FAILED',
        };
      }
    }
  }

  public async getRawProcessList(): Promise<RawProcessInfo[]> {
    try {
      const res = await this.runner.execute('ps', ['-eo', 'pid,ppid,comm,args']);
      if (res.exitCode !== 0 || !res.stdout) return [];

      const lines = res.stdout.trim().split('\n');
      if (lines.length <= 1) return [];

      const list: RawProcessInfo[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (!line) continue;

        const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/);
        if (match) {
          const comm = match[3]!;
          list.push({
            pid: parseInt(match[1]!, 10),
            ppid: parseInt(match[2]!, 10),
            comm,
            args: match[4] || comm,
            executablePath: comm,
          });
        }
      }

      return list;
    } catch {
      return [];
    }
  }

  public async buildProcessTree(activePids: number[]): Promise<ProcessTreeNode[]> {
    const rawList = await this.getRawProcessList();
    if (rawList.length === 0) return [];

    const procMap = new Map<number, RawProcessInfo>();
    const childrenMap = new Map<number, number[]>();

    for (const p of rawList) {
      procMap.set(p.pid, p);
      if (!childrenMap.has(p.ppid)) {
        childrenMap.set(p.ppid, []);
      }
      childrenMap.get(p.ppid)!.push(p.pid);
    }

    const roots: ProcessTreeNode[] = [];
    const visited = new Set<number>();

    const buildNode = (pid: number): ProcessTreeNode => {
      visited.add(pid);
      const raw = procMap.get(pid);
      const childPids = childrenMap.get(pid) || [];

      const childrenNodes = childPids
        .filter((c) => !visited.has(c))
        .map((c) => buildNode(c));

      const processName = raw ? raw.comm.split('/').pop() || raw.comm : `PID ${pid}`;

      return {
        pid,
        processName,
        ppid: raw?.ppid ?? null,
        command: raw?.args,
        isAiAgent: false,
        trafficIn: 0,
        trafficOut: 0,
        activeSockets: 0,
        children: childrenNodes,
      };
    };

    for (const pid of activePids) {
      if (!visited.has(pid)) {
        let curr = pid;
        while (procMap.has(curr) && procMap.get(curr)!.ppid > 1 && procMap.has(procMap.get(curr)!.ppid)) {
          curr = procMap.get(curr)!.ppid;
        }

        if (!visited.has(curr)) {
          roots.push(buildNode(curr));
        }
      }
    }

    return roots;
  }

  public async getProcessFamily(pid: number): Promise<{
    parent: { pid: number; processName: string } | null;
    children: Array<{ pid: number; processName: string }>;
  }> {
    const rawList = await this.getRawProcessList();
    const procMap = new Map<number, RawProcessInfo>(rawList.map((p) => [p.pid, p]));

    const target = procMap.get(pid);
    let parent: { pid: number; processName: string } | null = null;

    if (target && target.ppid > 0 && procMap.has(target.ppid)) {
      const p = procMap.get(target.ppid)!;
      parent = {
        pid: p.pid,
        processName: p.comm.split('/').pop() || p.comm,
      };
    }

    const children = rawList
      .filter((p) => p.ppid === pid)
      .map((p) => ({
        pid: p.pid,
        processName: p.comm.split('/').pop() || p.comm,
      }));

    return { parent, children };
  }
}

export const macProcessProvider = new MacProcessProvider();
