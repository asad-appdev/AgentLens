import type { TrafficSummary, ProcessTraffic } from '@network-monitor/shared';
import type { IPlatformTrafficProvider } from '../interfaces/traffic-provider.interface.js';

import { CommandRunnerService, commandRunner } from '../../services/command-runner.service.js';
import { safeParsePowerShellJson } from './parsers/powershell-json.parser.js';

interface AdapterStatRecord {
  Name?: string;
  ReceivedBytes?: number | string;
  SentBytes?: number | string;
}

export class WindowsTrafficProvider implements IPlatformTrafficProvider {
  private lastSampleTimeMs = 0;
  private lastTotalReceivedBytes = 0;
  private lastTotalSentBytes = 0;
  private peakDownloadRate = 0;
  private peakUploadRate = 0;
  private currentDownloadRate = 0;
  private currentUploadRate = 0;

  private readonly processTrafficMap = new Map<number, ProcessTraffic>();

  constructor(private readonly runner: CommandRunnerService = commandRunner) {}

  public async sampleTraffic(): Promise<TrafficSummary> {
    const now = Date.now();
    let totalReceived = 0;
    let totalSent = 0;

    try {
      const result = await this.runner.execute('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-NetAdapterStatistics | Select-Object Name,ReceivedBytes,SentBytes | ConvertTo-Json -Compress',
      ]);

      if (result.exitCode === 0 && result.stdout.trim()) {
        const stats = safeParsePowerShellJson<AdapterStatRecord>(result.stdout);
        for (const s of stats) {
          const rx = parseInt(String(s.ReceivedBytes || '0'), 10);
          const tx = parseInt(String(s.SentBytes || '0'), 10);
          if (!isNaN(rx) && rx > 0) totalReceived += rx;
          if (!isNaN(tx) && tx > 0) totalSent += tx;
        }
      }
    } catch {
      // Return previous rates if sample failed
    }

    if (this.lastSampleTimeMs > 0 && totalReceived > 0) {
      const deltaSec = Math.max((now - this.lastSampleTimeMs) / 1000, 0.5);
      const deltaRx = Math.max(totalReceived - this.lastTotalReceivedBytes, 0);
      const deltaTx = Math.max(totalSent - this.lastTotalSentBytes, 0);

      this.currentDownloadRate = Math.round(deltaRx / deltaSec);
      this.currentUploadRate = Math.round(deltaTx / deltaSec);

      this.peakDownloadRate = Math.max(this.peakDownloadRate, this.currentDownloadRate);
      this.peakUploadRate = Math.max(this.peakUploadRate, this.currentUploadRate);
    }

    this.lastSampleTimeMs = now;
    this.lastTotalReceivedBytes = totalReceived;
    this.lastTotalSentBytes = totalSent;

    const processes = Array.from(this.processTrafficMap.values());
    const activeProcesses = processes.filter((p) => p.bytesInPerSecond > 0 || p.bytesOutPerSecond > 0).length;

    return {
      timestamp: new Date().toISOString(),
      totalProcesses: processes.length,
      activeProcesses,
      totalBytesInPerSecond: this.currentDownloadRate,
      totalBytesOutPerSecond: this.currentUploadRate,
      processes,
    };
  }


  public getAllProcessTraffic(): ProcessTraffic[] {
    return Array.from(this.processTrafficMap.values());
  }

  public getTrafficForPid(pid: number): ProcessTraffic | undefined {
    return this.processTrafficMap.get(pid);
  }

  public setProcessTraffic(pid: number, traffic: ProcessTraffic): void {
    this.processTrafficMap.set(pid, traffic);
  }
}
