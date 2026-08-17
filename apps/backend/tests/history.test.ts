import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../src/services/database.service.js';
import { HistoryService } from '../src/services/history.service.js';
import { ExportService } from '../src/services/export.service.js';
import { ProcessHistoryRecord, ConnectionHistoryRecord, TrafficHistoryRecord } from '@network-monitor/shared';

describe('History & Database Storage Unit Tests (Phase 8)', () => {
  let dbService: DatabaseService;
  let historyService: HistoryService;
  let exportService: ExportService;

  beforeEach(() => {
    // Isolated in-memory SQLite database for test suite
    dbService = new DatabaseService({ inMemory: true });
    historyService = new HistoryService(dbService);
    exportService = new ExportService(historyService);
  });

  it('should initialize SQLite tables and report available status', () => {
    expect(dbService.isAvailable()).toBe(true);
    const status = historyService.getStatus();
    expect(status.isAvailable).toBe(true);
    expect(status.isRecording).toBe(true);
    expect(status.totalProcessRecords).toBe(0);
  });

  it('should insert and query process records with filters', () => {
    const now = Date.now();
    const mockProcs: ProcessHistoryRecord[] = [
      { timestamp: new Date(now).toISOString(), pid: 101, processName: 'ollama', isAiAgent: true, aiAgentName: 'Ollama', createdAt: now },
      { timestamp: new Date(now).toISOString(), pid: 202, processName: 'chrome', isAiAgent: false, createdAt: now },
    ];

    historyService.recordProcessBatch(mockProcs);

    const all = historyService.queryProcesses();
    expect(all.total).toBe(2);
    expect(all.records).toHaveLength(2);

    const aiOnly = historyService.queryProcesses({ isAiAgent: true });
    expect(aiOnly.total).toBe(1);
    expect(aiOnly.records[0]!.processName).toBe('ollama');

    const pidSearch = historyService.queryProcesses({ pid: 202 });
    expect(pidSearch.total).toBe(1);
    expect(pidSearch.records[0]!.processName).toBe('chrome');
  });

  it('should insert and query connection records with pagination and IP search', () => {
    const now = Date.now();
    const mockConns: ConnectionHistoryRecord[] = [
      {
        timestamp: new Date(now).toISOString(),
        pid: 101,
        processName: 'ollama',
        protocol: 'TCP',
        localAddress: '127.0.0.1',
        localPort: 11434,
        remoteAddress: '142.250.72.14',
        remotePort: 443,
        state: 'ESTABLISHED',
        isAiAgent: true,
        aiAgentName: 'Ollama',
        createdAt: now,
      },
      {
        timestamp: new Date(now).toISOString(),
        pid: 202,
        processName: 'node',
        protocol: 'TCP',
        localAddress: '127.0.0.1',
        localPort: 3000,
        remoteAddress: null,
        remotePort: null,
        state: 'LISTEN',
        isAiAgent: false,
        createdAt: now,
      },
    ];

    historyService.recordConnectionBatch(mockConns);

    const res = historyService.queryConnections();
    expect(res.total).toBe(2);

    const ipQuery = historyService.queryConnections({ remoteAddress: '142.250.72.14' });
    expect(ipQuery.total).toBe(1);
    expect(ipQuery.records[0]!.processName).toBe('ollama');
  });

  it('should calculate traffic timeline buckets correctly', () => {
    const baseTime = Date.now() - 60000; // 1 min ago
    const trafficRows: TrafficHistoryRecord[] = [
      { timestamp: new Date(baseTime).toISOString(), pid: 101, processName: 'ollama', bytesInPerSecond: 10000, bytesOutPerSecond: 2000, totalBytesPerSecond: 12000, isAiAgent: true, createdAt: baseTime },
      { timestamp: new Date(baseTime + 10000).toISOString(), pid: 101, processName: 'ollama', bytesInPerSecond: 20000, bytesOutPerSecond: 4000, totalBytesPerSecond: 24000, isAiAgent: true, createdAt: baseTime + 10000 },
    ];

    historyService.recordTrafficBatch(trafficRows);

    const timeline = historyService.getTrafficTimeline(baseTime - 5000, baseTime + 30000, 10);
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline[0]!.totalRate).toBeGreaterThan(0);
  });

  it('should rank top processes and top contacted remote IPs', () => {
    const now = Date.now();
    historyService.recordTrafficBatch([
      { timestamp: new Date(now).toISOString(), pid: 101, processName: 'ollama', bytesInPerSecond: 50000, bytesOutPerSecond: 10000, totalBytesPerSecond: 60000, isAiAgent: true, createdAt: now },
      { timestamp: new Date(now).toISOString(), pid: 202, processName: 'curl', bytesInPerSecond: 1000, bytesOutPerSecond: 500, totalBytesPerSecond: 1500, isAiAgent: false, createdAt: now },
    ]);

    historyService.recordConnectionBatch([
      { timestamp: new Date(now).toISOString(), pid: 101, processName: 'ollama', protocol: 'TCP', remoteAddress: '142.250.72.14', remotePort: 443, isAiAgent: true, createdAt: now },
      { timestamp: new Date(now).toISOString(), pid: 101, processName: 'ollama', protocol: 'TCP', remoteAddress: '142.250.72.14', remotePort: 443, isAiAgent: true, createdAt: now },
      { timestamp: new Date(now).toISOString(), pid: 202, processName: 'curl', protocol: 'TCP', remoteAddress: '1.1.1.1', remotePort: 80, isAiAgent: false, createdAt: now },
    ]);

    const topProcs = historyService.getTopProcesses(now - 10000, now + 10000);
    expect(topProcs.length).toBe(2);
    expect(topProcs[0]!.processName).toBe('ollama');

    const topIps = historyService.getTopRemoteIps(now - 10000, now + 10000);
    expect(topIps[0]!.remoteAddress).toBe('142.250.72.14');
    expect(topIps[0]!.connectionsCount).toBe(2);
  });

  it('should support process detail historical summaries', () => {
    const now = Date.now();
    historyService.recordProcessBatch([
      { timestamp: new Date(now).toISOString(), pid: 555, processName: 'lmstudio', isAiAgent: true, aiAgentName: 'LM Studio', createdAt: now },
    ]);
    historyService.recordConnectionBatch([
      { timestamp: new Date(now).toISOString(), pid: 555, processName: 'lmstudio', protocol: 'TCP', remoteAddress: '93.184.216.34', remotePort: 443, isAiAgent: true, createdAt: now },
    ]);
    historyService.recordTrafficBatch([
      { timestamp: new Date(now).toISOString(), pid: 555, processName: 'lmstudio', bytesInPerSecond: 1024, bytesOutPerSecond: 512, totalBytesPerSecond: 1536, isAiAgent: true, createdAt: now },
    ]);

    const detail = historyService.getProcessDetail(555);
    expect(detail).not.toBeNull();
    expect(detail?.processName).toBe('lmstudio');
    expect(detail?.uniqueRemoteIps).toContain('93.184.216.34');
    expect(detail?.isAiAgent).toBe(true);
  });

  it('should clear historical data without throwing errors', () => {
    const now = Date.now();
    historyService.recordProcessBatch([
      { timestamp: new Date(now).toISOString(), pid: 1, processName: 'test', isAiAgent: false, createdAt: now },
    ]);

    expect(historyService.getStatus().totalProcessRecords).toBe(1);

    const clearRes = historyService.clearHistory();
    expect(clearRes.success).toBe(true);
    expect(historyService.getStatus().totalProcessRecords).toBe(0);
  });

  it('should generate valid RFC 4180 CSV with escaped quotes and commas', () => {
    const now = Date.now();
    historyService.recordConnectionBatch([
      {
        timestamp: new Date(now).toISOString(),
        pid: 777,
        processName: 'Special, "Quoted" App',
        protocol: 'TCP',
        localAddress: '127.0.0.1',
        localPort: 8080,
        remoteAddress: '1.2.3.4',
        remotePort: 80,
        state: 'ESTABLISHED',
        isAiAgent: false,
        createdAt: now,
      },
    ]);

    const csv = exportService.generateConnectionsCsv(now - 1000, now + 1000);
    expect(csv).toContain('timestamp,pid,process_name,protocol');
    expect(csv).toContain('"Special, ""Quoted"" App"');
  });

  it('should generate historical JSON export with metadata and schema version', () => {
    const now = Date.now();
    const json = exportService.generateHistoryJson(now - 10000, now + 10000);
    expect(json.version).toBe(1);
    expect(json.schemaVersion).toBe('1.0.0');
    expect(json.timeRange).toBeDefined();
  });
});
