import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WindowsFirewallProvider } from '../src/platform/windows/windows-firewall.provider.js';
import { CommandRunnerService } from '../src/services/command-runner.service.js';

describe('Windows Firewall Provider Unit Tests', () => {
  let tempDir: string;
  let provider: WindowsFirewallProvider;
  let mockRunner: CommandRunnerService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-fw-test-'));
    mockRunner = new CommandRunnerService(true);
    provider = new WindowsFirewallProvider({ dataDir: tempDir, runner: mockRunner });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should generate properly scoped PortScope_Block_ rule names for IPs', () => {
    const ruleName = provider.getRuleNameForIp('142.250.72.14');
    expect(ruleName).toBe('PortScope_Block_142_250_72_14');
  });

  it('should reject invalid IP addresses', async () => {
    const result = await provider.blockIp('invalid-ip-string');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_IP');
  });

  it('should reject protected loopback and unspecified addresses', async () => {
    const resLoopback = await provider.blockIp('127.0.0.1');
    expect(resLoopback.success).toBe(false);
    expect(resLoopback.errorCode).toBe('PROTECTED_IP');

    const resZero = await provider.blockIp('0.0.0.0');
    expect(resZero.success).toBe(false);
    expect(resZero.errorCode).toBe('PROTECTED_IP');

    const resV6 = await provider.blockIp('::1');
    expect(resV6.success).toBe(false);
    expect(resV6.errorCode).toBe('PROTECTED_IP');
  });


  it('should block, query, and unblock remote IP addresses safely', async () => {
    const testIp = '198.51.100.14'; // RFC 5737 documentation test IP
    const blockRes = await provider.blockIp(testIp, 'Suspicious remote host');

    expect(blockRes.success).toBe(true);
    expect(blockRes.blockedIp).toBeDefined();
    expect(blockRes.blockedIp?.ip).toBe(testIp);
    expect(provider.isIpBlocked(testIp)).toBe(true);

    const list = provider.getBlockedIps();
    expect(list).toHaveLength(1);
    expect(list[0]!.ip).toBe(testIp);

    const unblockRes = await provider.unblockIp(testIp);
    expect(unblockRes.success).toBe(true);
    expect(unblockRes.unblockedIp).toBe(testIp);
    expect(provider.isIpBlocked(testIp)).toBe(false);
  });

  it('should record audit events for firewall actions', async () => {
    const testIp = '198.51.100.22';
    await provider.blockIp(testIp);
    await provider.unblockIp(testIp);

    const audit = provider.getAuditEvents();
    expect(audit.length).toBeGreaterThanOrEqual(2);
    expect(audit.some((e) => e.action === 'block_ip' && e.ip === testIp)).toBe(true);
    expect(audit.some((e) => e.action === 'unblock_ip' && e.ip === testIp)).toBe(true);
  });
});
