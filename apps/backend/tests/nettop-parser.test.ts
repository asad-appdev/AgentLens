import { describe, it, expect, beforeEach } from 'vitest';
import { NettopParser } from '../src/services/nettop-parser.service.js';
import { NettopService } from '../src/services/nettop.service.js';
import { NetworkMonitorService } from '../src/services/network-monitor.service.js';
import { createTrafficSnapshotMessage } from '../src/websocket/protocol.js';
import { NetworkConnection } from '@network-monitor/shared';

describe('NettopParser & NettopService (Phase 5 Unit Tests)', () => {
  let parser: NettopParser;
  let service: NettopService;

  beforeEach(() => {
    parser = new NettopParser();
    service = new NettopService(undefined, parser, {
      activeThresholdBytesPerSecond: 1000,
      staleProcessTimeoutMs: 5000,
      maxHistoryPoints: 10,
    });
  });

  it('Test 1: should parse process PID, name, and byte counters from nettop CSV output', () => {
    const raw = `
time,,interface,state,bytes_in,bytes_out,rx_dupe,rx_ooo,re-tx,rtt_avg,rcvsize,tx_win,tc_class,tc_mgt,cc_algo,P,C,R,W,arch,
01:01:46.872376,Slack Helper.5034,,,108093,67721,2720,1288,2721,,,,,,,,,,,,
01:01:46.872373,LM Studio.750,,,5000,12000,0,0,0,,,,,,,,,,,,
    `;

    const result = parser.parse(raw);
    expect(result.records).toHaveLength(2);

    const r1 = result.records[0]!;
    expect(r1.pid).toBe(5034);
    expect(r1.processName).toBe('Slack Helper');
    expect(r1.bytesIn).toBe(108093);
    expect(r1.bytesOut).toBe(67721);

    const r2 = result.records[1]!;
    expect(r2.pid).toBe(750);
    expect(r2.processName).toBe('LM Studio');
    expect(r2.bytesIn).toBe(5000);
    expect(r2.bytesOut).toBe(12000);
  });

  it('Test 2: should calculate accurate rates on counter increase over elapsed time', () => {
    const t0 = 1000000;
    const t1 = t0 + 2000; // 2 seconds elapsed

    // Cycle 0 baseline: 1,000,000 bytes
    service.updateRegistryWithRecords([
      { pid: 1234, processName: 'node', bytesIn: 1000000, bytesOut: 500000, timestamp: '0' },
    ], t0);

    // Cycle 1: 1,500,000 bytes in (delta 500,000), 700,000 bytes out (delta 200,000) over 2s
    service.updateRegistryWithRecords([
      { pid: 1234, processName: 'node', bytesIn: 1500000, bytesOut: 700000, timestamp: '1' },
    ], t1);

    const traffic = service.getTrafficForPid(1234);
    expect(traffic).toBeDefined();
    expect(traffic!.bytesInPerSecond).toBe(250000); // 500,000 / 2
    expect(traffic!.bytesOutPerSecond).toBe(100000); // 200,000 / 2
    expect(traffic!.totalBytesPerSecond).toBe(350000);
    expect(traffic!.activity).toBe('ACTIVE');
  });

  it('Test 3: should handle counter reset safely without producing negative rates', () => {
    const t0 = 1000000;
    const t1 = t0 + 1000;

    // Baseline: 500,000 bytes
    service.updateRegistryWithRecords([
      { pid: 1234, processName: 'node', bytesIn: 500000, bytesOut: 500000, timestamp: '0' },
    ], t0);

    // Reset: current counter drops to 1,000 bytes (e.g. process restarted)
    service.updateRegistryWithRecords([
      { pid: 1234, processName: 'node', bytesIn: 1000, bytesOut: 1000, timestamp: '1' },
    ], t1);

    const traffic = service.getTrafficForPid(1234);
    expect(traffic).toBeDefined();
    expect(traffic!.bytesInPerSecond).toBe(0);
    expect(traffic!.bytesOutPerSecond).toBe(0);
    expect(traffic!.totalBytesPerSecond).toBe(0);
  });

  it('Test 4: should clean up stale processes when they disappear', () => {
    const t0 = 1000000;
    const tStale = t0 + 10000; // 10s later (> 5s stale timeout)

    service.updateRegistryWithRecords([
      { pid: 9999, processName: 'temporary_task', bytesIn: 1000, bytesOut: 1000, timestamp: '0' },
    ], t0);

    expect(service.getTrafficForPid(9999)).toBeDefined();

    service.cleanupStaleProcesses(tStale);
    expect(service.getTrafficForPid(9999)).toBeNull();
  });

  it('Test 5: should reset baseline when PID is reused by a new process', () => {
    const t0 = 1000000;
    const t1 = t0 + 1000;

    // Process A on PID 2000
    service.updateRegistryWithRecords([
      { pid: 2000, processName: 'old_process', bytesIn: 10000000, bytesOut: 10000000, timestamp: '0' },
    ], t0);

    // Process B replaces PID 2000 with a new name and fresh counters
    service.updateRegistryWithRecords([
      { pid: 2000, processName: 'new_worker', bytesIn: 500, bytesOut: 500, timestamp: '1' },
    ], t1);

    const traffic = service.getTrafficForPid(2000);
    expect(traffic).toBeDefined();
    expect(traffic!.processName).toBe('new_worker');
    expect(traffic!.bytesInPerSecond).toBe(0);
    expect(traffic!.bytesOutPerSecond).toBe(0);
  });

  it('Test 6: should skip malformed lines without throwing or terminating parser', () => {
    const raw = `
time,,interface,state,bytes_in,bytes_out
CORRUPTED_LINE
01:01:46.872376,valid.1234,,,1000,2000,,,,,,,,,,,,
INVALID_PID_FORMAT.NOT_A_NUM,,,0,0
    `;

    const result = parser.parse(raw);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!.pid).toBe(1234);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('Test 7: should calculate independent rates for multiple distinct processes', () => {
    const t0 = 1000000;
    const t1 = t0 + 1000;

    service.updateRegistryWithRecords([
      { pid: 101, processName: 'procA', bytesIn: 1000, bytesOut: 1000, timestamp: '0' },
      { pid: 102, processName: 'procB', bytesIn: 1000, bytesOut: 1000, timestamp: '0' },
    ], t0);

    service.updateRegistryWithRecords([
      { pid: 101, processName: 'procA', bytesIn: 5000, bytesOut: 1000, timestamp: '1' }, // deltaIn = 4000
      { pid: 102, processName: 'procB', bytesIn: 1000, bytesOut: 9000, timestamp: '1' }, // deltaOut = 8000
    ], t1);

    const trafficA = service.getTrafficForPid(101);
    const trafficB = service.getTrafficForPid(102);

    expect(trafficA!.bytesInPerSecond).toBe(4000);
    expect(trafficA!.bytesOutPerSecond).toBe(0);

    expect(trafficB!.bytesInPerSecond).toBe(0);
    expect(trafficB!.bytesOutPerSecond).toBe(8000);
  });

  it('Test 8: should classify traffic activity as ACTIVE vs IDLE based on threshold', () => {
    const t0 = 1000000;
    const t1 = t0 + 1000;

    service.updateRegistryWithRecords([
      { pid: 201, processName: 'idle_proc', bytesIn: 1000, bytesOut: 1000, timestamp: '0' },
      { pid: 202, processName: 'active_proc', bytesIn: 1000, bytesOut: 1000, timestamp: '0' },
    ], t0);

    service.updateRegistryWithRecords([
      { pid: 201, processName: 'idle_proc', bytesIn: 1200, bytesOut: 1000, timestamp: '1' }, // totalRate = 200 (< 1000 threshold)
      { pid: 202, processName: 'active_proc', bytesIn: 6000, bytesOut: 1000, timestamp: '1' }, // totalRate = 5000 (>= 1000 threshold)
    ], t1);

    expect(service.getTrafficForPid(201)!.activity).toBe('IDLE');
    expect(service.getTrafficForPid(202)!.activity).toBe('ACTIVE');
  });

  it('Test 9: should build standard traffic_snapshot WebSocket messages', () => {
    const summary = {
      timestamp: '2026-08-15T01:00:00.000Z',
      totalProcesses: 1,
      activeProcesses: 1,
      totalBytesInPerSecond: 5000,
      totalBytesOutPerSecond: 1000,
      processes: [
        {
          pid: 4218,
          processName: 'ollama',
          bytesIn: 50000,
          bytesOut: 10000,
          bytesInPerSecond: 5000,
          bytesOutPerSecond: 1000,
          totalBytesPerSecond: 6000,
          activity: 'ACTIVE' as const,
          isAiAgent: true,
          aiAgentName: 'Ollama',
          lastUpdated: Date.now(),
        },
      ],
    };

    const wsMsg = createTrafficSnapshotMessage(summary);
    expect(wsMsg.type).toBe('traffic_snapshot');
    expect(wsMsg.payload).toBeDefined();
    expect(wsMsg.payload!.processes).toHaveLength(1);
    expect(wsMsg.payload!.processes[0]!.isAiAgent).toBe(true);
    expect(wsMsg.payload!.totalBytesInPerSecond).toBe(5000);
  });

  it('Test 10: should merge process traffic with network connections and strictly label scope as PROCESS', () => {
    const monitor = new NetworkMonitorService(undefined, service);

    // Setup active traffic for PID 4218
    service.updateRegistryWithRecords([
      { pid: 4218, processName: 'ollama', bytesIn: 10000, bytesOut: 10000, timestamp: '0' },
    ], 1000000);

    service.updateRegistryWithRecords([
      { pid: 4218, processName: 'ollama', bytesIn: 110000, bytesOut: 10000, timestamp: '1' },
    ], 1001000); // 100,000 bytes/sec rate

    const mockConnections: NetworkConnection[] = [
      {
        id: 'conn-1',
        protocol: 'TCP',
        localAddress: '127.0.0.1',
        localPort: 11434,
        remoteAddress: null,
        remotePort: null,
        state: 'LISTEN',
        processName: 'ollama',
        pid: 4218,
        ipVersion: 'IPv4',
        isListening: true,
        discoveredAt: '2026-08-15T00:00:00.000Z',
      },
      {
        id: 'conn-2',
        protocol: 'TCP',
        localAddress: '127.0.0.1',
        localPort: 54321,
        remoteAddress: '142.250.72.14',
        remotePort: 443,
        state: 'ESTABLISHED',
        processName: 'ollama',
        pid: 4218,
        ipVersion: 'IPv4',
        isListening: false,
        discoveredAt: '2026-08-15T00:00:00.000Z',
      },
    ];

    const merged = monitor.mergeConnectionsWithTraffic(mockConnections);
    expect(merged).toHaveLength(2);

    for (const conn of merged) {
      expect(conn.traffic).toBeDefined();
      expect(conn.traffic!.scope).toBe('PROCESS'); // Explicit PROCESS scope guarantee
      expect(conn.traffic!.bytesInPerSecond).toBe(100000);
      expect(conn.traffic!.activity).toBe('ACTIVE');
      expect(conn.isAiAgent).toBe(true);
      expect(conn.aiAgentName).toBe('Ollama');
    }
  });
});
