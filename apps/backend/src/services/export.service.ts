import {
  ExportHistoryPayload,
  ConnectionHistoryRecord,
  HistorySummary,
  NetworkConnection,
  ProcessTraffic,
  BlockedIp,
  FirewallStatus,
} from '@network-monitor/shared';
import { HistoryService, historyService } from './history.service.js';
import { MacOSService, macosService } from './macos.service.js';

export class ExportService {
  private readonly history: HistoryService;
  private readonly macos: MacOSService;

  constructor(history: HistoryService = historyService, macos: MacOSService = macosService) {
    this.history = history;
    this.macos = macos;
  }

  /**
   * Generates a complete current live state snapshot in structured JSON.
   */
  public async generateSnapshotExport(): Promise<{
    exportedAt: string;
    version: number;
    connections: NetworkConnection[];
    processes: ProcessTraffic[];
    blockedIps: BlockedIp[];
    firewallStatus: FirewallStatus;
  }> {
    const connections = await this.macos.getNetworkConnections();
    const processes = this.macos.getAllProcessTraffic();
    const firewall = this.macos.getFirewallService();
    const blockedIps = firewall.getBlockedIps();
    const firewallStatus = firewall.getFirewallStatus();

    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      connections,
      processes,
      blockedIps,
      firewallStatus,
    };
  }

  /**
   * Generates a historical JSON export for the specified time range.
   */
  public generateHistoryJson(fromMs: number, toMs: number): ExportHistoryPayload {
    const summary: HistorySummary = this.history.getHistorySummary(fromMs, toMs);
    const connResult = this.history.queryConnections({ from: fromMs, to: toMs, limit: 1000 });
    const procResult = this.history.queryProcesses({ from: fromMs, to: toMs, limit: 1000 });
    const firewallEvents = this.macos.getFirewallService().getAuditEvents();

    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      schemaVersion: '1.0.0',
      timeRange: {
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
      },
      summary,
      connections: connResult.records,
      processes: procResult.records,
      firewallEvents,
    };
  }

  /**
   * Generates an RFC 4180-compliant CSV string for historical connections.
   */
  public generateConnectionsCsv(fromMs: number, toMs: number): string {
    const connResult = this.history.queryConnections({ from: fromMs, to: toMs, limit: 1000 });
    const headers = [
      'timestamp',
      'pid',
      'process_name',
      'protocol',
      'local_address',
      'local_port',
      'remote_address',
      'remote_port',
      'state',
      'is_ai_agent',
      'ai_agent_name',
    ];

    const rows = connResult.records.map((r: ConnectionHistoryRecord) => [
      r.timestamp,
      r.pid.toString(),
      this.escapeCsvCell(r.processName),
      r.protocol,
      r.localAddress || '',
      r.localPort !== null && r.localPort !== undefined ? r.localPort.toString() : '',
      r.remoteAddress || '',
      r.remotePort !== null && r.remotePort !== undefined ? r.remotePort.toString() : '',
      r.state || '',
      r.isAiAgent ? 'true' : 'false',
      this.escapeCsvCell(r.aiAgentName || ''),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Generates an RFC 4180-compliant CSV string for traffic history.
   */
  public generateTrafficCsv(fromMs: number, toMs: number): string {
    const timeline = this.history.getTrafficTimeline(fromMs, toMs, 100);
    const headers = ['timestamp', 'bytes_in_per_sec', 'bytes_out_per_sec', 'total_bytes_per_sec', 'active_processes'];

    const rows = timeline.map((b) => [
      b.timestamp,
      b.bytesInRate.toString(),
      b.bytesOutRate.toString(),
      b.totalRate.toString(),
      b.activeProcesses.toString(),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Escapes a string value according to RFC 4180 CSV specifications.
   */
  public escapeCsvCell(val: string | number | boolean | null | undefined): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

export const exportService = new ExportService();
