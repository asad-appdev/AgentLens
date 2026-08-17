import {
  ProcessHistoryRecord,
  ConnectionHistoryRecord,
  TrafficHistoryRecord,
  TrafficTimelineBucket,
  TopProcessStat,
  TopRemoteIpStat,
  ProcessDetailHistory,
  HistorySummary,
  GroupedProcessConnections,
  HistoryStatus,
  MAX_HISTORY_QUERY_LIMIT,
} from '@network-monitor/shared';
import { DatabaseService, databaseService } from './database.service.js';
import { formatBytes } from '../utils/formatters.js';

export interface HistoryQueryOptions {
  from?: number; // epoch ms
  to?: number;   // epoch ms
  pid?: number;
  processName?: string;
  remoteAddress?: string;
  isAiAgent?: boolean;
  limit?: number;
  offset?: number;
}

export class HistoryService {
  private readonly dbService: DatabaseService;
  private isRecording = true;

  constructor(dbService: DatabaseService = databaseService) {
    this.dbService = dbService;
  }

  public isRecordingEnabled(): boolean {
    return this.isRecording && this.dbService.isAvailable();
  }

  public setRecordingEnabled(enabled: boolean): void {
    this.isRecording = enabled;
  }

  /**
   * Records a batch of process observations in a single transaction.
   */
  public recordProcessBatch(records: ProcessHistoryRecord[]): void {
    if (!this.isRecordingEnabled() || records.length === 0) return;
    const db = this.dbService.getDatabase();
    if (!db) return;

    const stmt = db.prepare(`
      INSERT INTO process_history (
        timestamp, pid, process_name, command, cpu_percent, memory_bytes, is_ai_agent, ai_agent_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows: ProcessHistoryRecord[]) => {
      for (const row of rows) {
        stmt.run(
          row.timestamp,
          row.pid,
          row.processName,
          row.command ?? null,
          row.cpuPercent ?? 0,
          row.memoryBytes ?? 0,
          row.isAiAgent ? 1 : 0,
          row.aiAgentName ?? null,
          row.createdAt
        );
      }
    });

    try {
      insertMany(records);
    } catch (err) {
      console.warn('[HistoryService] Error inserting process batch:', err);
    }
  }

  /**
   * Records a batch of active connection observations.
   */
  public recordConnectionBatch(records: ConnectionHistoryRecord[]): void {
    if (!this.isRecordingEnabled() || records.length === 0) return;
    const db = this.dbService.getDatabase();
    if (!db) return;

    const stmt = db.prepare(`
      INSERT INTO connection_history (
        timestamp, pid, process_name, protocol, local_address, local_port, remote_address, remote_port, state, is_ai_agent, ai_agent_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows: ConnectionHistoryRecord[]) => {
      for (const row of rows) {
        stmt.run(
          row.timestamp,
          row.pid,
          row.processName,
          row.protocol,
          row.localAddress ?? null,
          row.localPort ?? null,
          row.remoteAddress ?? null,
          row.remotePort ?? null,
          row.state ?? null,
          row.isAiAgent ? 1 : 0,
          row.aiAgentName ?? null,
          row.createdAt
        );
      }
    });

    try {
      insertMany(records);
    } catch (err) {
      console.warn('[HistoryService] Error inserting connection batch:', err);
    }
  }

  /**
   * Records aggregated traffic rates for active processes.
   */
  public recordTrafficBatch(records: TrafficHistoryRecord[]): void {
    if (!this.isRecordingEnabled() || records.length === 0) return;
    const db = this.dbService.getDatabase();
    if (!db) return;

    const stmt = db.prepare(`
      INSERT INTO traffic_history (
        timestamp, pid, process_name, bytes_in_rate, bytes_out_rate, total_rate, is_ai_agent, ai_agent_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows: TrafficHistoryRecord[]) => {
      for (const row of rows) {
        stmt.run(
          row.timestamp,
          row.pid,
          row.processName,
          row.bytesInPerSecond,
          row.bytesOutPerSecond,
          row.totalBytesPerSecond,
          row.isAiAgent ? 1 : 0,
          row.aiAgentName ?? null,
          row.createdAt
        );
      }
    });

    try {
      insertMany(records);
    } catch (err) {
      console.warn('[HistoryService] Error inserting traffic batch:', err);
    }
  }

  /**
   * Queries historical connection records with filters and pagination.
   */
  public queryConnections(options: HistoryQueryOptions = {}): { total: number; records: ConnectionHistoryRecord[] } {
    const db = this.dbService.getDatabase();
    if (!db) return { total: 0, records: [] };

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.from) {
      conditions.push('created_at >= ?');
      params.push(options.from);
    }
    if (options.to) {
      conditions.push('created_at <= ?');
      params.push(options.to);
    }
    if (options.pid) {
      conditions.push('pid = ?');
      params.push(options.pid);
    }
    if (options.processName) {
      conditions.push('process_name LIKE ?');
      params.push(`%${options.processName}%`);
    }
    if (options.remoteAddress) {
      conditions.push('remote_address LIKE ?');
      params.push(`%${options.remoteAddress}%`);
    }
    if (options.isAiAgent !== undefined) {
      conditions.push('is_ai_agent = ?');
      params.push(options.isAiAgent ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM connection_history ${whereClause}`).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const limit = Math.min(options.limit || 100, MAX_HISTORY_QUERY_LIMIT);
    const offset = options.offset || 0;

    const rows = db.prepare(`
      SELECT * FROM connection_history
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    const records: ConnectionHistoryRecord[] = rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      pid: r.pid,
      processName: r.process_name,
      protocol: r.protocol,
      localAddress: r.local_address,
      localPort: r.local_port,
      remoteAddress: r.remote_address,
      remotePort: r.remote_port,
      state: r.state,
      isAiAgent: r.is_ai_agent === 1,
      aiAgentName: r.ai_agent_name,
      createdAt: r.created_at,
    }));

    return { total, records };
  }

  /**
   * Queries historical process records with filters and pagination.
   */
  public queryProcesses(options: HistoryQueryOptions = {}): { total: number; records: ProcessHistoryRecord[] } {
    const db = this.dbService.getDatabase();
    if (!db) return { total: 0, records: [] };

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.from) {
      conditions.push('created_at >= ?');
      params.push(options.from);
    }
    if (options.to) {
      conditions.push('created_at <= ?');
      params.push(options.to);
    }
    if (options.pid) {
      conditions.push('pid = ?');
      params.push(options.pid);
    }
    if (options.processName) {
      conditions.push('process_name LIKE ?');
      params.push(`%${options.processName}%`);
    }
    if (options.isAiAgent !== undefined) {
      conditions.push('is_ai_agent = ?');
      params.push(options.isAiAgent ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM process_history ${whereClause}`).get(...params) as { cnt: number };
    const total = countRow?.cnt || 0;

    const limit = Math.min(options.limit || 100, MAX_HISTORY_QUERY_LIMIT);
    const offset = options.offset || 0;

    const rows = db.prepare(`
      SELECT * FROM process_history
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    const records: ProcessHistoryRecord[] = rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      pid: r.pid,
      processName: r.process_name,
      command: r.command,
      cpuPercent: r.cpu_percent,
      memoryBytes: r.memory_bytes,
      isAiAgent: r.is_ai_agent === 1,
      aiAgentName: r.ai_agent_name,
      createdAt: r.created_at,
    }));

    return { total, records };
  }

  /**
   * Generates time-series traffic buckets for line/area charts.
   */
  public getTrafficTimeline(fromMs: number, toMs: number, bucketCount = 30): TrafficTimelineBucket[] {
    const db = this.dbService.getDatabase();
    if (!db) return [];

    const duration = Math.max(toMs - fromMs, 1000);
    const bucketIntervalMs = Math.max(Math.floor(duration / bucketCount), 1000);

    const rows = db.prepare(`
      SELECT
        (created_at / ?) * ? as bucket_time,
        AVG(bytes_in_rate) as avg_in,
        AVG(bytes_out_rate) as avg_out,
        AVG(total_rate) as avg_total,
        COUNT(DISTINCT pid) as active_pids
      FROM traffic_history
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY bucket_time
      ORDER BY bucket_time ASC
    `).all(bucketIntervalMs, bucketIntervalMs, fromMs, toMs) as any[];

    return rows.map((r) => ({
      timestamp: new Date(r.bucket_time).toISOString(),
      timeEpochMs: r.bucket_time,
      bytesInRate: Math.round(r.avg_in || 0),
      bytesOutRate: Math.round(r.avg_out || 0),
      totalRate: Math.round(r.avg_total || 0),
      activeProcesses: r.active_pids || 0,
    }));
  }

  /**
   * Returns top most active processes by observed traffic and connections.
   */
  public getTopProcesses(fromMs: number, toMs: number, limit = 10, aiOnly = false): TopProcessStat[] {
    const db = this.dbService.getDatabase();
    if (!db) return [];

    const aiClause = aiOnly ? 'AND is_ai_agent = 1' : '';

    const rows = db.prepare(`
      SELECT
        process_name,
        pid,
        is_ai_agent,
        ai_agent_name,
        SUM(bytes_in_rate * 5) as est_bytes_in,
        SUM(bytes_out_rate * 5) as est_bytes_out,
        SUM(total_rate * 5) as est_total_bytes,
        MAX(total_rate) as peak_rate,
        MIN(timestamp) as first_seen,
        MAX(timestamp) as last_seen,
        COUNT(*) as samples_count
      FROM traffic_history
      WHERE created_at >= ? AND created_at <= ? ${aiClause}
      GROUP BY process_name, pid
      ORDER BY est_total_bytes DESC
      LIMIT ?
    `).all(fromMs, toMs, limit) as any[];

    return rows.map((r) => ({
      processName: r.process_name,
      pid: r.pid,
      isAiAgent: r.is_ai_agent === 1,
      aiAgentName: r.ai_agent_name,
      totalBytesIn: r.est_bytes_in || 0,
      totalBytesOut: r.est_bytes_out || 0,
      totalBytes: r.est_total_bytes || 0,
      peakRate: r.peak_rate || 0,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      connectionCount: r.samples_count,
    }));
  }

  /**
   * Returns most contacted remote IP addresses.
   */
  public getTopRemoteIps(fromMs: number, toMs: number, limit = 20): TopRemoteIpStat[] {
    const db = this.dbService.getDatabase();
    if (!db) return [];

    const rows = db.prepare(`
      SELECT
        remote_address,
        COUNT(*) as conn_count,
        MIN(timestamp) as first_seen,
        MAX(timestamp) as last_seen,
        GROUP_CONCAT(DISTINCT process_name) as processes
      FROM connection_history
      WHERE created_at >= ? AND created_at <= ?
        AND remote_address IS NOT NULL
        AND remote_address != ''
        AND remote_address != '*'
        AND remote_address != '127.0.0.1'
        AND remote_address != '::1'
      GROUP BY remote_address
      ORDER BY conn_count DESC
      LIMIT ?
    `).all(fromMs, toMs, limit) as any[];

    return rows.map((r) => ({
      remoteAddress: r.remote_address,
      connectionsCount: r.conn_count,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      associatedProcesses: r.processes ? r.processes.split(',') : [],
      isBlocked: false, // Updated by caller with firewall state
    }));
  }

  /**
   * Returns detailed history summary for a single PID.
   */
  public getProcessDetail(pid: number): ProcessDetailHistory | null {
    const db = this.dbService.getDatabase();
    if (!db) return null;

    const procRow = db.prepare(`
      SELECT process_name, is_ai_agent, ai_agent_name, MIN(timestamp) as first_seen, MAX(timestamp) as last_seen, COUNT(*) as cnt
      FROM process_history WHERE pid = ?
    `).get(pid) as any;

    if (!procRow || !procRow.process_name) return null;

    const trafficRow = db.prepare(`
      SELECT
        SUM(bytes_in_rate * 5) as total_in,
        SUM(bytes_out_rate * 5) as total_out,
        MAX(bytes_in_rate) as peak_in,
        MAX(bytes_out_rate) as peak_out
      FROM traffic_history WHERE pid = ?
    `).get(pid) as any;

    const ipRows = db.prepare(`
      SELECT DISTINCT remote_address, remote_port
      FROM connection_history
      WHERE pid = ? AND remote_address IS NOT NULL AND remote_address != '' AND remote_address != '*'
    `).all(pid) as any[];

    const uniqueRemoteIps = Array.from(new Set(ipRows.map((r) => r.remote_address).filter(Boolean)));
    const uniqueRemotePorts = Array.from(new Set(ipRows.map((r) => r.remote_port).filter((p) => p !== null && p !== undefined)));

    const recentConnRows = db.prepare(`
      SELECT * FROM connection_history WHERE pid = ? ORDER BY created_at DESC LIMIT 20
    `).all(pid) as any[];

    const recentConnections: ConnectionHistoryRecord[] = recentConnRows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      pid: r.pid,
      processName: r.process_name,
      protocol: r.protocol,
      localAddress: r.local_address,
      localPort: r.local_port,
      remoteAddress: r.remote_address,
      remotePort: r.remote_port,
      state: r.state,
      isAiAgent: r.is_ai_agent === 1,
      aiAgentName: r.ai_agent_name,
      createdAt: r.created_at,
    }));

    const now = Date.now();
    const trafficTimeline = this.getTrafficTimeline(now - 3600000, now, 20);

    return {
      pid,
      processName: procRow.process_name,
      isAiAgent: procRow.is_ai_agent === 1,
      aiAgentName: procRow.ai_agent_name,
      firstSeen: procRow.first_seen,
      lastSeen: procRow.last_seen,
      totalObservations: procRow.cnt,
      uniqueRemoteIps,
      uniqueRemotePorts,
      totalDownloadedBytes: trafficRow?.total_in || 0,
      totalUploadedBytes: trafficRow?.total_out || 0,
      peakDownloadRate: trafficRow?.peak_in || 0,
      peakUploadRate: trafficRow?.peak_out || 0,
      recentConnections,
      trafficTimeline,
    };
  }

  /**
   * Groups connections by active process.
   */
  public groupConnectionsByProcess(liveConnections: any[], blockedIpsSet: Set<string>): GroupedProcessConnections[] {
    const map = new Map<number, GroupedProcessConnections>();

    for (const conn of liveConnections) {
      if (!map.has(conn.pid)) {
        map.set(conn.pid, {
          processName: conn.processName,
          pid: conn.pid,
          isAiAgent: !!conn.isAiAgent,
          aiAgentName: conn.aiAgentName,
          totalBytesInPerSecond: conn.traffic?.bytesInPerSecond || 0,
          totalBytesOutPerSecond: conn.traffic?.bytesOutPerSecond || 0,
          activeSocketsCount: 0,
          endpoints: [],
        });
      }

      const group = map.get(conn.pid)!;
      group.activeSocketsCount++;
      const isBlocked = conn.remoteAddress ? blockedIpsSet.has(conn.remoteAddress.toLowerCase()) : false;

      group.endpoints.push({
        protocol: conn.protocol,
        localPort: conn.localPort,
        remoteAddress: conn.remoteAddress,
        remotePort: conn.remotePort,
        state: conn.state,
        isBlocked,
      });
    }

    return Array.from(map.values()).sort((a, b) => b.activeSocketsCount - a.activeSocketsCount);
  }

  /**
   * Calculates high-level history analytics summary for a given time window.
   */
  public getHistorySummary(fromMs: number, toMs: number): HistorySummary {
    const db = this.dbService.getDatabase();
    const defaultSummary: HistorySummary = {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      totalDownloaded: 0,
      totalUploaded: 0,
      peakDownload: 0,
      peakUpload: 0,
      averageDownload: 0,
      averageUpload: 0,
      topProcesses: [],
      topAiAgents: [],
      uniqueRemoteIps: 0,
      totalRecordedConnections: 0,
    };

    if (!db) return defaultSummary;

    const trafficRow = db.prepare(`
      SELECT
        SUM(bytes_in_rate * 5) as total_in,
        SUM(bytes_out_rate * 5) as total_out,
        MAX(bytes_in_rate) as peak_in,
        MAX(bytes_out_rate) as peak_out,
        AVG(bytes_in_rate) as avg_in,
        AVG(bytes_out_rate) as avg_out
      FROM traffic_history
      WHERE created_at >= ? AND created_at <= ?
    `).get(fromMs, toMs) as any;

    const uniqueIpsRow = db.prepare(`
      SELECT COUNT(DISTINCT remote_address) as ip_cnt, COUNT(*) as conn_cnt
      FROM connection_history
      WHERE created_at >= ? AND created_at <= ?
        AND remote_address IS NOT NULL AND remote_address != '' AND remote_address != '*'
    `).get(fromMs, toMs) as any;

    const topProcesses = this.getTopProcesses(fromMs, toMs, 5, false);
    const topAiAgents = this.getTopProcesses(fromMs, toMs, 5, true);

    return {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      totalDownloaded: trafficRow?.total_in || 0,
      totalUploaded: trafficRow?.total_out || 0,
      peakDownload: trafficRow?.peak_in || 0,
      peakUpload: trafficRow?.peak_out || 0,
      averageDownload: Math.round(trafficRow?.avg_in || 0),
      averageUpload: Math.round(trafficRow?.avg_out || 0),
      topProcesses,
      topAiAgents,
      uniqueRemoteIps: uniqueIpsRow?.ip_cnt || 0,
      totalRecordedConnections: uniqueIpsRow?.conn_cnt || 0,
    };
  }

  /**
   * Returns current operational status of the history subsystem.
   */
  public getStatus(): HistoryStatus {
    const isAvail = this.dbService.isAvailable();
    const db = this.dbService.getDatabase();
    const dbSizeBytes = this.dbService.getDatabaseSizeBytes();

    if (!isAvail || !db) {
      return {
        isAvailable: false,
        isRecording: false,
        databaseSizeBytes: 0,
        databaseSizeFormatted: '0 B',
        retentionDays: 7,
        totalProcessRecords: 0,
        totalConnectionRecords: 0,
        totalTrafficRecords: 0,
      };
    }

    try {
      const procCount = (db.prepare('SELECT COUNT(*) as c FROM process_history').get() as any)?.c || 0;
      const connCount = (db.prepare('SELECT COUNT(*) as c FROM connection_history').get() as any)?.c || 0;
      const trafficCount = (db.prepare('SELECT COUNT(*) as c FROM traffic_history').get() as any)?.c || 0;

      const oldest = (db.prepare('SELECT MIN(timestamp) as t FROM connection_history').get() as any)?.t;
      const newest = (db.prepare('SELECT MAX(timestamp) as t FROM connection_history').get() as any)?.t;

      return {
        isAvailable: true,
        isRecording: this.isRecording,
        databaseSizeBytes: dbSizeBytes,
        databaseSizeFormatted: formatBytes(dbSizeBytes),
        retentionDays: 7,
        totalProcessRecords: procCount,
        totalConnectionRecords: connCount,
        totalTrafficRecords: trafficCount,
        oldestRecordTimestamp: oldest || undefined,
        newestRecordTimestamp: newest || undefined,
      };
    } catch {
      return {
        isAvailable: true,
        isRecording: this.isRecording,
        databaseSizeBytes: dbSizeBytes,
        databaseSizeFormatted: formatBytes(dbSizeBytes),
        retentionDays: 7,
        totalProcessRecords: 0,
        totalConnectionRecords: 0,
        totalTrafficRecords: 0,
      };
    }
  }

  /**
   * Clears historical database records older than the specified timestamp (or all records if none specified).
   * Strictly preserves firewall rules and blocked IPs.
   */
  public clearHistory(olderThanMs?: number): { success: boolean; deletedCount: number } {
    const db = this.dbService.getDatabase();
    if (!db) return { success: false, deletedCount: 0 };

    try {
      let deleted = 0;
      if (olderThanMs !== undefined) {
        const d1 = db.prepare('DELETE FROM process_history WHERE created_at < ?').run(olderThanMs);
        const d2 = db.prepare('DELETE FROM connection_history WHERE created_at < ?').run(olderThanMs);
        const d3 = db.prepare('DELETE FROM traffic_history WHERE created_at < ?').run(olderThanMs);
        deleted = d1.changes + d2.changes + d3.changes;
      } else {
        const d1 = db.prepare('DELETE FROM process_history').run();
        const d2 = db.prepare('DELETE FROM connection_history').run();
        const d3 = db.prepare('DELETE FROM traffic_history').run();
        deleted = d1.changes + d2.changes + d3.changes;
        db.exec('VACUUM');
      }

      return { success: true, deletedCount: deleted };
    } catch (err) {
      console.error('[HistoryService] Error clearing history:', err);
      return { success: false, deletedCount: 0 };
    }
  }
}

export const historyService = new HistoryService(databaseService);
