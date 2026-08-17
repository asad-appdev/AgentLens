import type { ProcessSignal, ProcessTreeNode } from '@network-monitor/shared';
import type { IPlatformProcessProvider, RawProcessInfo, TerminateProcessResult } from '../interfaces/process-provider.interface.js';

import { CommandRunnerService, commandRunner } from '../../services/command-runner.service.js';
import { parseWin32ProcessesJson, parseWindowsTasklistCsv } from './parsers/windows-process.parser.js';

export class WindowsProcessProvider implements IPlatformProcessProvider {
  constructor(private readonly runner: CommandRunnerService = commandRunner) {}

  public async terminateProcess(
    pid: number,
    signal: ProcessSignal = 'SIGTERM',
    dryRun = false
  ): Promise<TerminateProcessResult> {
    // Windows protected processes: PID 0 (System Idle), PID 4 (System)
    if (pid <= 4) {
      return {
        success: false,
        message: `Safety violation: Refusing to terminate Windows core system process PID ${pid}.`,
        errorCode: 'PROTECTED_PROCESS',
      };
    }

    if (dryRun) {
      return {
        success: true,
        message: `[Dry Run] Simulated taskkill termination of Windows PID ${pid} (${signal}).`,
      };
    }

    try {
      // Safe execution using strict argument arrays: taskkill.exe /PID <pid> /T /F
      const result = await this.runner.execute('taskkill.exe', ['/PID', String(pid), '/T', '/F']);

      if (result.exitCode === 0) {
        return {
          success: true,
          message: `Successfully terminated process PID ${pid}.`,
        };
      }

      const stderr = (result.stderr || '').toLowerCase();
      const stdout = (result.stdout || '').toLowerCase();

      if (stderr.includes('not found') || stdout.includes('not found') || stderr.includes('does not exist')) {
        return {
          success: true,
          message: `Process PID ${pid} was already terminated.`,
        };
      }

      if (stderr.includes('access is denied') || stderr.includes('denied') || stdout.includes('access is denied')) {
        return {
          success: false,
          message: `Permission denied: Administrator privileges are required to terminate PID ${pid}.`,
          errorCode: 'INSUFFICIENT_PRIVILEGES',
        };
      }

      return {
        success: false,
        message: result.stderr || result.stdout || `Failed to terminate PID ${pid}.`,
        errorCode: 'TERMINATION_FAILED',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || `Failed to execute taskkill for PID ${pid}.`,
        errorCode: 'TERMINATION_FAILED',
      };
    }
  }

  public async getRawProcessList(): Promise<RawProcessInfo[]> {
    // 1. Try PowerShell Get-CimInstance Win32_Process
    try {
      const result = await this.runner.execute('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress',
      ]);

      if (result.exitCode === 0 && result.stdout.trim()) {
        const list = parseWin32ProcessesJson(result.stdout);
        if (list.length > 0) return list;
      }
    } catch {
      // Fallback
    }

    // 2. Fallback to tasklist /FO CSV /V
    try {
      const tasklistRes = await this.runner.execute('tasklist', ['/FO', 'CSV', '/V']);
      if (tasklistRes.exitCode === 0 && tasklistRes.stdout.trim()) {
        return parseWindowsTasklistCsv(tasklistRes.stdout);
      }
    } catch {
      // Return empty if fallback fails
    }

    return [];
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

      const processName = raw ? raw.comm : `PID ${pid}`;

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
        const seenAncestors = new Set<number>([curr]);
        while (procMap.has(curr) && procMap.get(curr)!.ppid > 4 && procMap.has(procMap.get(curr)!.ppid)) {
          const nextPpid = procMap.get(curr)!.ppid;
          if (seenAncestors.has(nextPpid)) break;
          seenAncestors.add(nextPpid);
          curr = nextPpid;
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
        processName: p.comm,
      };
    }

    const children = rawList
      .filter((p) => p.ppid === pid)
      .map((p) => ({
        pid: p.pid,
        processName: p.comm,
      }));

    return { parent, children };
  }
}
