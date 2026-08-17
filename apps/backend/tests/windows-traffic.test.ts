import { describe, it, expect } from 'vitest';
import { WindowsTrafficProvider } from '../src/platform/windows/windows-traffic.provider.js';
import { CommandRunnerService } from '../src/services/command-runner.service.js';

describe('Windows Traffic Provider Unit Tests', () => {
  it('should sample traffic and return normalized TrafficSummary structure', async () => {
    const mockRunner = new CommandRunnerService(true);
    const provider = new WindowsTrafficProvider(mockRunner);

    provider.setProcessTraffic(48231, {
      pid: 48231,
      processName: 'node.exe',
      bytesIn: 102400,
      bytesOut: 20480,
      bytesInPerSecond: 5120,
      bytesOutPerSecond: 1024,
      totalBytesPerSecond: 6144,
      activity: 'ACTIVE',
      lastUpdated: Date.now(),
    });

    const summary = await provider.sampleTraffic();
    expect(summary).toBeDefined();
    expect(summary).toHaveProperty('timestamp');
    expect(summary.totalProcesses).toBe(1);
    expect(summary.activeProcesses).toBe(1);
    expect(summary.processes).toHaveLength(1);
    expect(summary.processes[0]!.pid).toBe(48231);
    expect(summary.processes[0]!.activity).toBe('ACTIVE');

    const procTraffic = provider.getTrafficForPid(48231);
    expect(procTraffic).toBeDefined();
    expect(procTraffic!.processName).toBe('node.exe');

    const allTraffic = provider.getAllProcessTraffic();
    expect(allTraffic).toHaveLength(1);
  });
});
