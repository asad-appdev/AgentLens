import {
  AnalystContextSummary,
} from '@network-monitor/shared';
import { MacOSService, macosService } from '../services/macos.service.js';
import { HistoryService, historyService } from '../services/history.service.js';
import { aiAgentNetworkService } from '../intelligence/ai/ai-network.service.js';
import { behaviorAnalyzerService } from '../intelligence/behavior/behavior-analyzer.service.js';
import { formatBytes, formatBytesPerSec } from '../utils/formatters.js';

export class AnalystContextService {
  private readonly macos: MacOSService;
  private readonly history: HistoryService;

  constructor(macos: MacOSService = macosService, history: HistoryService = historyService) {
    this.macos = macos;
    this.history = history;
  }

  /**
   * Generates a structured snapshot of current system and network intelligence.
   */
  public async getContextSummary(): Promise<{ summary: AnalystContextSummary; systemPromptContext: string }> {
    const connections = await this.macos.getNetworkConnections();
    const trafficList = this.macos.getAllProcessTraffic();
    const aiProfiles = await aiAgentNetworkService.getAiAgentProfiles();
    const indicators = await behaviorAnalyzerService.analyzeLiveBehavior();
    const suggestions = behaviorAnalyzerService.getSmartSuggestions();
    const historySummary = this.history.getHistorySummary(Date.now() - 24 * 3600 * 1000, Date.now());

    const activeAiAgents = aiProfiles.filter((p) => p.processCount > 0);
    const sortedTraffic = [...trafficList].sort(
      (a, b) => b.bytesInPerSecond + b.bytesOutPerSecond - (a.bytesInPerSecond + a.bytesOutPerSecond)
    );

    const totalDown = trafficList.reduce((acc, t) => acc + t.bytesInPerSecond, 0);
    const totalUp = trafficList.reduce((acc, t) => acc + t.bytesOutPerSecond, 0);

    const summary: AnalystContextSummary = {
      activeSocketsCount: connections.length,
      totalDownloadRate: totalDown,
      totalUploadRate: totalUp,
      activeAiAgents: activeAiAgents.map((a) => a.displayName),
      topProcesses: sortedTraffic.slice(0, 5).map((t) => ({
        name: t.processName,
        pid: t.pid,
        downloadRate: t.bytesInPerSecond,
        uploadRate: t.bytesOutPerSecond,
      })),
      recentNewEndpoints: suggestions.slice(0, 5).map((s: any) => `${s.remoteIp}:${s.remotePort}`),
      behaviorIndicatorsCount: indicators.length,
    };


    // Construct concise LLM prompt context
    const lines: string[] = [];
    lines.push(`CURRENT TIME: ${new Date().toISOString()}`);
    lines.push(`SYSTEM NETWORK SNAPSHOT:`);
    lines.push(`- Active Sockets Count: ${connections.length}`);
    lines.push(`- Live Total Bandwidth: ↓ ${formatBytesPerSec(totalDown)} | ↑ ${formatBytesPerSec(totalUp)}`);
    lines.push(`- 24-Hour Historical Total: ${formatBytes(historySummary.totalDownloaded + historySummary.totalUploaded)}`);

    lines.push(`\nTOP ACTIVE PROCESSES BY BANDWIDTH:`);
    if (sortedTraffic.length > 0) {
      for (const p of sortedTraffic.slice(0, 5)) {
        lines.push(`- ${p.processName} (PID ${p.pid}): ↓ ${formatBytesPerSec(p.bytesInPerSecond)} / ↑ ${formatBytesPerSec(p.bytesOutPerSecond)}`);
      }
    } else {
      lines.push(`- No high-bandwidth active processes observed.`);
    }

    lines.push(`\nACTIVE AI AGENTS:`);
    if (activeAiAgents.length > 0) {
      for (const a of activeAiAgents) {
        lines.push(`- ${a.displayName} (${a.category}): ${a.processCount} processes, ↓ ${formatBytesPerSec(a.currentDownloadRate)}, ${a.connectionsCount} sockets, ${a.remoteHostsCount} remote hosts.`);
      }
    } else {
      lines.push(`- None active currently.`);
    }

    lines.push(`\nBEHAVIOR INDICATORS & OBSERVATIONS:`);
    if (indicators.length > 0) {
      for (const ind of indicators.slice(0, 4)) {
        lines.push(`- [${ind.type}] ${ind.entityId}: ${ind.label}. ${ind.explanation}`);
      }
    } else {
      lines.push(`- All processes are operating within standard historical baselines.`);
    }

    return {
      summary,
      systemPromptContext: lines.join('\n'),
    };
  }
}

export const analystContextService = new AnalystContextService();
