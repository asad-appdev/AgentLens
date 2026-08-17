import { describe, it, expect } from 'vitest';
import { MacOSService } from '../src/services/macos.service.js';

describe('MacOSService (Phase 7)', () => {
  const service = new MacOSService();

  it('should provide system metadata safely without privileges', () => {
    const metadata = service.getSystemMetadata();
    expect(metadata).toBeDefined();
    expect(metadata.platform).toBeDefined();
    expect(metadata.uptime).toBeGreaterThanOrEqual(0);
    expect(metadata.cpuCount).toBeGreaterThan(0);
  });

  it('should return parsed network connections via lsof', async () => {
    const connections = await service.getNetworkConnections();
    expect(Array.isArray(connections)).toBe(true);
    if (connections.length > 0) {
      const first = connections[0]!;
      expect(first.id).toBeDefined();
      expect(first.protocol).toMatch(/^(TCP|UDP)$/);
      expect(typeof first.pid).toBe('number');
      expect(typeof first.processName).toBe('string');
      expect(first.localAddress).toBeDefined();
    }
  });

  it('should block and unblock remote IP addresses safely in dedicated anchor', async () => {
    const testIp = '198.51.100.1'; // RFC 5737 documentation test IP
    const blockRes = await service.blockIp(testIp, 'Test block');
    expect(blockRes.success).toBe(true);
    expect(blockRes.blockedIp?.ip).toBe(testIp);

    const unblockRes = await service.unblockIp(testIp);
    expect(unblockRes.success).toBe(true);
    expect(unblockRes.unblockedIp).toBe(testIp);
  });

  it('should safely protect system process PID <= 1 and handle termination signals', async () => {
    const sysResult = await service.terminateProcess(1, 'SIGTERM');
    expect(sysResult.success).toBe(false);
    expect(sysResult.message).toContain('Safety violation');

    const dryRunResult = await service.terminateProcess(99999, 'SIGTERM', true);
    expect(dryRunResult.success).toBe(true);
    expect(dryRunResult.message).toContain('[Dry Run]');
  });
});
