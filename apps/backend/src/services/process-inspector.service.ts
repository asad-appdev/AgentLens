import {
  ProcessInspectorDetail,
  AiAgentInfo,
  AiConfidenceLevel,
  AiDetectionSource,
} from '@network-monitor/shared';
import { MacOSService, macosService } from './macos.service.js';
import { HistoryService, historyService } from './history.service.js';
import { SettingsService, settingsService } from './settings.service.js';
import { ProcessRelationshipService, processRelationshipService } from './process-relationship.service.js';

export class ProcessInspectorService {
  private readonly macos: MacOSService;
  private readonly history: HistoryService;
  private readonly settings: SettingsService;
  private readonly relationships: ProcessRelationshipService;

  constructor(
    macos: MacOSService = macosService,
    history: HistoryService = historyService,
    settings: SettingsService = settingsService,
    relationships: ProcessRelationshipService = processRelationshipService
  ) {
    this.macos = macos;
    this.history = history;
    this.settings = settings;
    this.relationships = relationships;
  }

  public async inspectProcess(pid: number): Promise<ProcessInspectorDetail | null> {
    const rawList = await this.relationships.getRawProcessList();
    const raw = rawList.find((p) => p.pid === pid);

    // Also check live connections
    const liveConns = await this.macos.getNetworkConnections();
    const matchingConns = liveConns.filter((c) => c.pid === pid);

    if (!raw && matchingConns.length === 0) {
      return null;
    }

    const processName = raw ? raw.comm.split('/').pop() || raw.comm : matchingConns[0]?.processName || `PID ${pid}`;
    const commandLine = raw ? raw.args : matchingConns[0]?.command || undefined;

    // Traffic metrics
    const processTraffic = this.macos.getAllProcessTraffic().find((t) => t.pid === pid);
    const histDetail = this.history.getProcessDetail(pid);

    const currentIn = processTraffic?.bytesInPerSecond || 0;
    const currentOut = processTraffic?.bytesOutPerSecond || 0;
    const peakIn = histDetail?.peakDownloadRate || currentIn;
    const peakOut = histDetail?.peakUploadRate || currentOut;
    const totalIn = histDetail?.totalDownloadedBytes || 0;
    const totalOut = histDetail?.totalUploadedBytes || 0;

    // Compute historical average throughput for comparison
    const histSummary = this.history.getHistorySummary(Date.now() - 24 * 3600 * 1000, Date.now());
    const histAvgIn = histSummary.averageDownload || 1;
    const histAvgOut = histSummary.averageUpload || 1;

    let relativeMultiplier: number | undefined;
    if (currentIn + currentOut > 0 && histAvgIn + histAvgOut > 0) {
      relativeMultiplier = parseFloat(((currentIn + currentOut) / (histAvgIn + histAvgOut)).toFixed(1));
    }

    // AI Classification
    const isKnownAi = matchingConns.some((c) => c.isAiAgent) || this.detectIsAi(processName, commandLine);
    const customLabel = this.settings.getProcessLabel(processName) || this.settings.getProcessLabel(pid.toString());
    const isManualAi = customLabel?.toLowerCase().includes('ai');

    const aiInfo: AiAgentInfo = {
      isAiAgent: isKnownAi || !!isManualAi,
      provider: matchingConns[0]?.aiAgentName || (isKnownAi ? 'Local AI Runtime' : undefined),
      confidence: (isManualAi ? 'high' : isKnownAi ? 'high' : 'low') as AiConfidenceLevel,
      detectionSource: (isManualAi ? 'manual' : 'process-name') as AiDetectionSource,
    };

    // Behavior indicators (Strictly neutral observations)
    const behaviorIndicators: string[] = [];
    if (currentIn + currentOut > 1024 * 1024) {
      behaviorIndicators.push('High Current Throughput (> 1 MB/s)');
    }
    if (matchingConns.length >= 10) {
      behaviorIndicators.push(`Many Active Sockets (${matchingConns.length})`);
    }
    if (relativeMultiplier && relativeMultiplier >= 3.0) {
      behaviorIndicators.push(`${relativeMultiplier}× Higher Than Historical Average`);
    }
    if (behaviorIndicators.length === 0) {
      behaviorIndicators.push('Normal Network Activity');
    }

    const { parent, children } = await this.relationships.getProcessFamily(pid);
    const uniqueRemoteIps = Array.from(new Set(matchingConns.map((c) => c.remoteAddress).filter(Boolean))) as string[];

    const isFavorite = this.settings.isFavorite(pid, processName);
    const tags = this.settings.getTags(processName);

    return {
      pid,
      processName,
      ppid: raw?.ppid ?? null,
      executablePath: raw?.comm,
      commandLine,
      user: matchingConns[0]?.user || undefined,
      firstObserved: histDetail?.firstSeen || new Date().toISOString(),
      lastObserved: histDetail?.lastSeen || new Date().toISOString(),
      isAiAgent: aiInfo.isAiAgent,
      aiInfo,
      customLabel,
      isFavorite,
      tags,
      traffic: {
        currentIn,
        currentOut,
        peakIn,
        peakOut,
        totalIn,
        totalOut,
        historicalAvgIn: histAvgIn,
        historicalAvgOut: histAvgOut,
        relativeToAvgMultiplier: relativeMultiplier,
      },
      behaviorIndicators,
      activeConnectionsCount: matchingConns.length,
      uniqueRemoteIps,
      parentProcess: parent,
      childProcesses: children.map((c) => ({
        pid: c.pid,
        processName: c.processName,
        activeSockets: liveConns.filter((conn) => conn.pid === c.pid).length,
      })),
    };
  }

  private detectIsAi(procName: string, commandLine?: string): boolean {
    const name = (procName + ' ' + (commandLine || '')).toLowerCase();
    return (
      name.includes('ollama') ||
      name.includes('lmstudio') ||
      name.includes('claude') ||
      name.includes('cursor') ||
      name.includes('chatgpt') ||
      name.includes('llama') ||
      name.includes('vllm') ||
      name.includes('localai')
    );
  }
}

export const processInspectorService = new ProcessInspectorService();
