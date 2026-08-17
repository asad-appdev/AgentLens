import {
  ProcessHistoryRecord,
  ConnectionHistoryRecord,
  TrafficHistoryRecord,
  DEFAULT_HISTORY_AGGREGATION_INTERVAL_MS,
} from '@network-monitor/shared';
import { HistoryService, historyService } from './history.service.js';
import { MacOSService, macosService } from './macos.service.js';
import { notificationService } from './notification.service.js';

export class HistoryAggregationService {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly history: HistoryService;
  private readonly macos: MacOSService;

  constructor(
    history: HistoryService = historyService,
    macos: MacOSService = macosService,
    intervalMs = DEFAULT_HISTORY_AGGREGATION_INTERVAL_MS
  ) {
    this.history = history;
    this.macos = macos;
    this.intervalMs = intervalMs;
  }

  public start(): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      await this.aggregateSnapshot();
    }, this.intervalMs);

    // Initial aggregation tick
    setTimeout(() => {
      this.aggregateSnapshot().catch((err) => {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[HistoryAggregationService] Initial tick notice:', err);
        }
      });
    }, 1000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async aggregateSnapshot(): Promise<void> {
    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const epochMs = now.getTime();

      // Sample live connections & traffic
      const connections = await this.macos.getNetworkConnections();
      const processTrafficList = this.macos.getAllProcessTraffic();

      // Evaluate notification rules (new AI agent, high traffic, new IP)
      notificationService.evaluateRules(connections, processTrafficList);

      if (!this.history.isRecordingEnabled()) return;

      // 1. Connection Records
      const connRecords: ConnectionHistoryRecord[] = connections.map((c) => ({
        timestamp,
        pid: c.pid,
        processName: c.processName,
        protocol: c.protocol,
        localAddress: c.localAddress,
        localPort: c.localPort,
        remoteAddress: c.remoteAddress,
        remotePort: c.remotePort,
        state: c.state,
        isAiAgent: !!c.isAiAgent,
        aiAgentName: c.aiAgentName,
        createdAt: epochMs,
      }));

      // 2. Process Records (Distinct PIDs observed)
      const seenPids = new Set<number>();
      const procRecords: ProcessHistoryRecord[] = [];

      for (const c of connections) {
        if (seenPids.has(c.pid)) continue;
        seenPids.add(c.pid);
        procRecords.push({
          timestamp,
          pid: c.pid,
          processName: c.processName,
          command: c.command,
          isAiAgent: !!c.isAiAgent,
          aiAgentName: c.aiAgentName,
          createdAt: epochMs,
        });
      }

      // 3. Traffic Records (Processes with observed traffic)
      const trafficRecords: TrafficHistoryRecord[] = processTrafficList.map((t) => ({
        timestamp,
        pid: t.pid,
        processName: t.processName,
        bytesInPerSecond: t.bytesInPerSecond,
        bytesOutPerSecond: t.bytesOutPerSecond,
        totalBytesPerSecond: t.totalBytesPerSecond,
        isAiAgent: !!t.isAiAgent,
        aiAgentName: t.aiAgentName,
        createdAt: epochMs,
      }));

      // Commit batches to SQLite
      this.history.recordProcessBatch(procRecords);
      this.history.recordConnectionBatch(connRecords);
      this.history.recordTrafficBatch(trafficRecords);
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[HistoryAggregationService] Snapshot aggregation warning:', err);
      }
    }
  }
}

export const historyAggregationService = new HistoryAggregationService();
