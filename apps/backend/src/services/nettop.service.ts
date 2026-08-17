import {
  ProcessTraffic,
  TrafficActivity,
  TrafficSummary,
  TrafficHistoryPoint,
  DEFAULT_TRAFFIC_ACTIVE_THRESHOLD_BYTES_PER_SECOND,
} from '@network-monitor/shared';
import { CommandRunnerService, commandRunner } from './command-runner.service.js';
import { NettopParser, nettopParser, RawProcessTrafficRecord } from './nettop-parser.service.js';

export interface ProcessTrafficState {
  pid: number;
  processName: string;
  bytesIn: number;
  bytesOut: number;
  bytesInPerSecond: number;
  bytesOutPerSecond: number;
  totalBytesPerSecond: number;
  activity: TrafficActivity;
  isAiAgent: boolean;
  aiAgentName?: string;
  lastUpdated: number;
  prevBytesIn?: number;
  prevBytesOut?: number;
  prevTimestamp?: number;
  history: TrafficHistoryPoint[];
}

export interface NettopServiceOptions {
  activeThresholdBytesPerSecond?: number;
  staleProcessTimeoutMs?: number;
  maxHistoryPoints?: number;
}

const KNOWN_AI_PROCESS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /ollama/i, name: 'Ollama' },
  { pattern: /lm\s*studio/i, name: 'LM Studio' },
  { pattern: /chatgpt/i, name: 'ChatGPT' },
  { pattern: /claude/i, name: 'Claude' },
  { pattern: /cursor/i, name: 'Cursor' },
  { pattern: /localai/i, name: 'LocalAI' },
  { pattern: /vllm/i, name: 'vLLM' },
  { pattern: /embeddings-serv/i, name: 'Embeddings Service' },
  { pattern: /llama\.cpp/i, name: 'llama.cpp' },
  { pattern: /jan/i, name: 'Jan AI' },
  { pattern: /text-generation/i, name: 'TextGen WebUI' },
];

export class NettopService {
  private readonly runner: CommandRunnerService;
  private readonly parser: NettopParser;
  private readonly activeThresholdBytesPerSec: number;
  private readonly staleProcessTimeoutMs: number;
  private readonly maxHistoryPoints: number;

  private registry = new Map<number, ProcessTrafficState>();
  private isAvailable: boolean = true;
  private lastErrorMessage: string | null = null;
  private lastPollTimestamp: number = 0;

  constructor(
    runner: CommandRunnerService = commandRunner,
    parser: NettopParser = nettopParser,
    options: NettopServiceOptions = {}
  ) {
    this.runner = runner;
    this.parser = parser;
    this.activeThresholdBytesPerSec =
      options.activeThresholdBytesPerSecond ??
      DEFAULT_TRAFFIC_ACTIVE_THRESHOLD_BYTES_PER_SECOND;
    this.staleProcessTimeoutMs = options.staleProcessTimeoutMs ?? 20000; // 20s stale cleanup
    this.maxHistoryPoints = options.maxHistoryPoints ?? 60; // 60 points max
  }

  /**
   * Executes a nettop snapshot sample and updates the process traffic registry.
   */
  public async sampleTraffic(): Promise<TrafficSummary> {
    const now = Date.now();

    try {
      // Execute fixed argument nettop sample: -P (process collapse), -n (numeric), -x (CSV), -L 1 (1 sample)
      const result = await this.runner.execute('nettop', ['-P', '-n', '-x', '-L', '1']);

      if (result.exitCode !== 0 && (!result.stdout || result.stdout.trim().length === 0)) {
        this.isAvailable = false;
        this.lastErrorMessage = result.stderr || `nettop exited with code ${result.exitCode}`;
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`[NettopService] Warning: ${this.lastErrorMessage}`);
        }
        return this.generateSummary(now);
      }

      this.isAvailable = true;
      this.lastErrorMessage = null;

      const parseResult = this.parser.parse(result.stdout, new Date(now).toISOString());
      this.updateRegistryWithRecords(parseResult.records, now);
      this.cleanupStaleProcesses(now);
      this.lastPollTimestamp = now;

      return this.generateSummary(now);
    } catch (err: unknown) {
      this.isAvailable = false;
      this.lastErrorMessage = err instanceof Error ? err.message : 'Unknown nettop execution error';
      if (process.env.NODE_ENV !== 'test') {
        console.error(`[NettopService] Failure sampling traffic:`, this.lastErrorMessage);
      }
      return this.generateSummary(now);
    }
  }

  /**
   * Updates in-memory registry using raw parsed nettop records.
   */
  public updateRegistryWithRecords(records: RawProcessTrafficRecord[], timestamp: number = Date.now()): void {
    for (const record of records) {
      const existing = this.registry.get(record.pid);

      // Check for PID reuse (if process name changed, reset baseline)
      const isPidReused = existing && existing.processName !== record.processName;

      if (!existing || isPidReused) {
        // First observation or PID reused by a new process
        const aiInfo = this.detectAiAgent(record.processName);
        const newState: ProcessTrafficState = {
          pid: record.pid,
          processName: record.processName,
          bytesIn: record.bytesIn,
          bytesOut: record.bytesOut,
          bytesInPerSecond: 0,
          bytesOutPerSecond: 0,
          totalBytesPerSecond: 0,
          activity: 'IDLE',
          isAiAgent: aiInfo.isAiAgent,
          aiAgentName: aiInfo.aiAgentName,
          lastUpdated: timestamp,
          prevBytesIn: record.bytesIn,
          prevBytesOut: record.bytesOut,
          prevTimestamp: timestamp,
          history: [{ timestamp, bytesInPerSecond: 0, bytesOutPerSecond: 0 }],
        };
        this.registry.set(record.pid, newState);
      } else {
        // Calculate rate based on counter deltas and elapsed time
        const elapsedSec = existing.prevTimestamp ? (timestamp - existing.prevTimestamp) / 1000 : 1;
        const validElapsedSec = elapsedSec > 0 ? elapsedSec : 1;

        let deltaIn = record.bytesIn - (existing.prevBytesIn ?? record.bytesIn);
        let deltaOut = record.bytesOut - (existing.prevBytesOut ?? record.bytesOut);

        // Counter reset handling (e.g. process restart or overflow -> no negative rate)
        if (deltaIn < 0 || record.bytesIn < (existing.prevBytesIn ?? 0)) {
          deltaIn = 0;
        }
        if (deltaOut < 0 || record.bytesOut < (existing.prevBytesOut ?? 0)) {
          deltaOut = 0;
        }

        const bytesInRate = Math.round(deltaIn / validElapsedSec);
        const bytesOutRate = Math.round(deltaOut / validElapsedSec);
        const totalRate = bytesInRate + bytesOutRate;

        const activity: TrafficActivity = totalRate >= this.activeThresholdBytesPerSec ? 'ACTIVE' : 'IDLE';

        // Update history
        const updatedHistory = [...existing.history, { timestamp, bytesInPerSecond: bytesInRate, bytesOutPerSecond: bytesOutRate }];
        if (updatedHistory.length > this.maxHistoryPoints) {
          updatedHistory.shift();
        }

        existing.bytesIn = record.bytesIn;
        existing.bytesOut = record.bytesOut;
        existing.bytesInPerSecond = bytesInRate;
        existing.bytesOutPerSecond = bytesOutRate;
        existing.totalBytesPerSecond = totalRate;
        existing.activity = activity;
        existing.lastUpdated = timestamp;
        existing.prevBytesIn = record.bytesIn;
        existing.prevBytesOut = record.bytesOut;
        existing.prevTimestamp = timestamp;
        existing.history = updatedHistory;
      }
    }
  }

  /**
   * Cleans up processes that have not appeared in recent nettop snapshots.
   */
  public cleanupStaleProcesses(currentTime: number = Date.now()): void {
    for (const [pid, state] of this.registry.entries()) {
      if (currentTime - state.lastUpdated > this.staleProcessTimeoutMs) {
        this.registry.delete(pid);
      }
    }
  }

  /**
   * Checks if a process is a known AI runtime/agent.
   */
  private detectAiAgent(processName: string): { isAiAgent: boolean; aiAgentName?: string } {
    for (const item of KNOWN_AI_PROCESS_PATTERNS) {
      if (item.pattern.test(processName)) {
        return { isAiAgent: true, aiAgentName: item.name };
      }
    }
    return { isAiAgent: false };
  }

  /**
   * Retrieves all current process traffic states.
   */
  public getAllProcessTraffic(): ProcessTraffic[] {
    const list: ProcessTraffic[] = [];
    for (const state of this.registry.values()) {
      list.push(this.mapStateToTraffic(state));
    }
    return list;
  }

  /**
   * Retrieves traffic for a specific PID.
   */
  public getTrafficForPid(pid: number): ProcessTraffic | null {
    const state = this.registry.get(pid);
    return state ? this.mapStateToTraffic(state) : null;
  }

  /**
   * Generates a structured traffic summary.
   */
  public generateSummary(timestamp: number = Date.now()): TrafficSummary {
    const processes = this.getAllProcessTraffic();
    let totalInRate = 0;
    let totalOutRate = 0;
    let activeCount = 0;

    for (const p of processes) {
      totalInRate += p.bytesInPerSecond;
      totalOutRate += p.bytesOutPerSecond;
      if (p.activity === 'ACTIVE') {
        activeCount++;
      }
    }

    return {
      timestamp: new Date(timestamp).toISOString(),
      totalProcesses: processes.length,
      activeProcesses: activeCount,
      totalBytesInPerSecond: totalInRate,
      totalBytesOutPerSecond: totalOutRate,
      processes,
    };
  }

  private mapStateToTraffic(state: ProcessTrafficState): ProcessTraffic {
    return {
      pid: state.pid,
      processName: state.processName,
      bytesIn: state.bytesIn,
      bytesOut: state.bytesOut,
      bytesInPerSecond: state.bytesInPerSecond,
      bytesOutPerSecond: state.bytesOutPerSecond,
      totalBytesPerSecond: state.totalBytesPerSecond,
      activity: state.activity,
      isAiAgent: state.isAiAgent,
      aiAgentName: state.aiAgentName,
      lastUpdated: state.lastUpdated,
      history: state.history,
    };
  }

  public getLastPollTimestamp(): number {
    return this.lastPollTimestamp;
  }

  public getStatus(): { isAvailable: boolean; lastErrorMessage: string | null; totalTracked: number } {
    return {
      isAvailable: this.isAvailable,
      lastErrorMessage: this.lastErrorMessage,
      totalTracked: this.registry.size,
    };
  }

  /**
   * Resets registry (primarily for test isolation).
   */
  public resetRegistry(): void {
    this.registry.clear();
  }
}

export const nettopService = new NettopService();
