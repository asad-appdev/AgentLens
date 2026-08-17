import {
  HistoricalBaseline,
  BehaviorIndicator,
  SmartFirewallSuggestion,
} from '@network-monitor/shared';
import { HistoryService, historyService } from '../../services/history.service.js';
import { platformService } from '../../platform/platform.service.js';
import { formatBytesPerSec } from '../../utils/formatters.js';

export class BehaviorAnalyzerService {
  private readonly history: HistoryService;
  private readonly suggestions: SmartFirewallSuggestion[] = [];

  constructor(history: HistoryService = historyService) {
    this.history = history;
  }

  private baselineCache: { baseline: HistoricalBaseline; cachedAt: number } | null = null;
  private readonly baselineCacheTtlMs = 15000; // 15s cache

  /**
   * Computes baseline statistics for an entity (process or agent).
   */
  public async getBaseline(entityId: string, entityType: 'agent' | 'process' = 'process'): Promise<HistoricalBaseline> {
    const now = Date.now();
    if (this.baselineCache && now - this.baselineCache.cachedAt < this.baselineCacheTtlMs) {
      return {
        ...this.baselineCache.baseline,
        entityId,
        entityType,
      };
    }

    const summary = this.history.getHistorySummary(now - 7 * 24 * 3600 * 1000, now);
    const isAvailable = summary.totalRecordedConnections > 10;

    const base: HistoricalBaseline = {
      entityId,
      entityType,
      typicalConnectionCount: Math.max(1, Math.round(summary.totalRecordedConnections / 20)),
      typicalRemoteHostCount: Math.max(1, Math.round(summary.uniqueRemoteIps / 10)),
      typicalUploadRate: Math.round(summary.averageUpload || 1024),
      typicalDownloadRate: Math.round(summary.averageDownload || 2048),
      typicalPorts: [80, 443, 11434],
      samplesCount: summary.totalRecordedConnections,
      firstRecorded: summary.from || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isAvailable,
    };

    this.baselineCache = { baseline: base, cachedAt: now };
    return base;
  }

  /**
   * Analyzes live processes and traffic against historical baselines using cross-platform providers.
   */
  public async analyzeLiveBehavior(): Promise<BehaviorIndicator[]> {
    const networkProvider = platformService.getNetworkProvider();
    const trafficProvider = platformService.getTrafficProvider();

    const [connections, trafficSnapshot, sharedBaseline] = await Promise.all([
      networkProvider.getConnections(),
      trafficProvider.sampleTraffic(),
      this.getBaseline('system', 'process'),
    ]);

    const trafficList = trafficSnapshot.processes || [];
    const indicators: BehaviorIndicator[] = [];
    const baselineRate = sharedBaseline.typicalDownloadRate + sharedBaseline.typicalUploadRate;

    for (const t of trafficList) {
      const currentRate = t.bytesInPerSecond + t.bytesOutPerSecond;

      // 1. High Throughput relative to baseline
      if (sharedBaseline.isAvailable && baselineRate > 0 && currentRate > baselineRate * 3 && currentRate > 1024 * 1024) {
        const multiplier = parseFloat((currentRate / baselineRate).toFixed(1));
        indicators.push({
          id: `ind-traffic-${t.pid}-${Date.now()}`,
          type: 'HIGH_TRAFFIC',
          entityId: t.processName,
          entityType: 'process',
          label: `${multiplier}× Higher Than Baseline`,
          explanation: `Current throughput is ${formatBytesPerSec(currentRate)} compared to typical historical baseline of ${formatBytesPerSec(baselineRate)}.`,
          currentValue: formatBytesPerSec(currentRate),
          baselineValue: formatBytesPerSec(baselineRate),
          multiplier,
          timestamp: new Date().toISOString(),
        });
      }

      // 2. High Connection Count
      const procConns = connections.filter((c) => c.pid === t.pid);
      if (procConns.length >= 30) {
        indicators.push({
          id: `ind-conns-${t.pid}-${Date.now()}`,
          type: 'HIGH_CONNECTION_COUNT',
          entityId: t.processName,
          entityType: 'process',
          label: `High Socket Count (${procConns.length})`,
          explanation: `Process is maintaining ${procConns.length} concurrent open sockets.`,
          currentValue: `${procConns.length} sockets`,
          baselineValue: `${sharedBaseline.typicalConnectionCount} sockets`,
          timestamp: new Date().toISOString(),
        });
      }

      // 3. Check for New Endpoints to generate Smart Suggestions
      for (const c of procConns) {
        if (c.remoteAddress && c.remoteAddress !== '*' && c.remoteAddress !== '127.0.0.1' && c.remoteAddress !== '::1') {
          if (!this.suggestions.some((s) => s.remoteIp === c.remoteAddress && s.processName === c.processName)) {
            this.suggestions.push({
              id: `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              processName: c.processName,
              pid: c.pid,
              remoteIp: c.remoteAddress,
              remotePort: c.remotePort || 443,
              reason: `Observed new connection from "${c.processName}" to remote endpoint ${c.remoteAddress}:${c.remotePort || 443}.`,
              timestamp: new Date().toISOString(),
              status: 'PENDING',
            });
          }
        }
      }
    }

    return indicators;
  }

  /**
   * Retrieves generated smart firewall suggestions.
   */
  public getSuggestions(): SmartFirewallSuggestion[] {
    return this.suggestions.filter((s) => s.status === 'PENDING');
  }

  public getSmartSuggestions(): SmartFirewallSuggestion[] {
    return this.getSuggestions();
  }


  /**
   * Updates status of a firewall suggestion.
   */
  public updateSuggestionStatus(id: string, status: SmartFirewallSuggestion['status']): boolean {
    const sug = this.suggestions.find((s) => s.id === id);
    if (sug) {
      sug.status = status;
      return true;
    }
    return false;
  }
}

export const behaviorAnalyzerService = new BehaviorAnalyzerService();
