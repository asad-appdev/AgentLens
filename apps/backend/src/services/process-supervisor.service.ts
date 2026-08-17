import { ChildProcess } from 'node:child_process';
import { MonitorState } from '@network-monitor/shared';
import { LoggerService, logger } from './logger.service.js';

export interface ManagedProcessInfo {
  name: string;
  command: string;
  args: string[];
  process: ChildProcess | null;
  pid: number | null;
  restartAttempts: number;
  maxRestartAttempts: number;
  lastRestartEpoch: number;
  state: MonitorState;
}

export class ProcessSupervisor {
  private readonly managedProcesses = new Map<string, ManagedProcessInfo>();
  private readonly logger: LoggerService;
  private isShuttingDown = false;

  constructor(loggerService: LoggerService = logger) {
    this.logger = loggerService;
  }

  public register(
    name: string,
    command: string,
    args: string[],
    maxAttempts = 5
  ): void {
    this.managedProcesses.set(name, {
      name,
      command,
      args,
      process: null,
      pid: null,
      restartAttempts: 0,
      maxRestartAttempts: maxAttempts,
      lastRestartEpoch: 0,
      state: 'stopped',
    });
  }

  public setChildProcess(name: string, child: ChildProcess): void {
    const info = this.managedProcesses.get(name);
    if (!info) return;

    info.process = child;
    info.pid = child.pid ?? null;
    info.state = 'running';

    child.on('exit', (code, signal) => {
      this.handleProcessExit(name, code, signal);
    });

    child.on('error', (err) => {
      this.logger.error(`[ProcessSupervisor] Error on process "${name}":`, err.message);
      info.state = 'degraded';
    });
  }

  public getState(name: string): MonitorState {
    return this.managedProcesses.get(name)?.state ?? 'stopped';
  }

  public getAllStates(): Record<string, MonitorState> {
    const res: Record<string, MonitorState> = {};
    for (const [name, info] of this.managedProcesses) {
      res[name] = info.state;
    }
    return res;
  }

  public handleProcessExit(name: string, code: number | null, signal: string | null): void {
    const info = this.managedProcesses.get(name);
    if (!info) return;

    info.process = null;
    info.pid = null;

    if (this.isShuttingDown) {
      info.state = 'stopped';
      return;
    }

    this.logger.warn(`[ProcessSupervisor] Managed process "${name}" exited (code=${code}, signal=${signal})`);

    if (info.restartAttempts >= info.maxRestartAttempts) {
      this.logger.error(`[ProcessSupervisor] Process "${name}" exceeded max restart attempts (${info.maxRestartAttempts}). Marking unavailable.`);
      info.state = 'unavailable';
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s
    const delayMs = Math.min(1000 * Math.pow(2, info.restartAttempts), 16000);
    info.restartAttempts++;
    info.lastRestartEpoch = Date.now();
    info.state = 'degraded';

    this.logger.info(`[ProcessSupervisor] Scheduling restart for "${name}" in ${delayMs / 1000}s (attempt ${info.restartAttempts}/${info.maxRestartAttempts})...`);

    setTimeout(() => {
      if (!this.isShuttingDown && info.state !== 'stopped') {
        this.logger.info(`[ProcessSupervisor] Restarting "${name}"...`);
        // The service responsible for this process should re-spawn and call setChildProcess
      }
    }, delayMs);
  }

  public terminateAll(): void {
    this.isShuttingDown = true;
    this.logger.info('[ProcessSupervisor] Terminating all supervised child processes...');

    for (const [name, info] of this.managedProcesses) {
      if (info.process && !info.process.killed) {
        try {
          this.logger.info(`[ProcessSupervisor] Killing "${name}" (PID ${info.pid})...`);
          info.process.kill('SIGTERM');
        } catch {
          // Process already dead
        }
      }
      info.state = 'stopped';
    }
  }
}

export const processSupervisor = new ProcessSupervisor();
