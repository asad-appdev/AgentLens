import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateIpAddress } from '../src/utils/ip-validator.js';
import { generateApplicationRules } from '../src/services/pf-rule-generator.js';
import { PfFirewallService } from '../src/services/pf-firewall.service.js';
import { IPfCommandRunner } from '../src/services/pf-command-runner.service.js';
import { BlockedIp, PF_APPLICATION_ANCHOR } from '@network-monitor/shared';

describe('IP Validation & Protection (Phase 7 Unit Tests)', () => {
  it('should validate standard IPv4 addresses', () => {
    const res1 = validateIpAddress('8.8.8.8');
    expect(res1.isValid).toBe(true);
    expect(res1.family).toBe('IPv4');
    expect(res1.normalizedIp).toBe('8.8.8.8');
    expect(res1.isProtected).toBe(false);

    const res2 = validateIpAddress('142.250.72.14');
    expect(res2.isValid).toBe(true);
    expect(res2.family).toBe('IPv4');
  });

  it('should validate standard IPv6 addresses', () => {
    const res = validateIpAddress('2001:4860:4860::8888');
    expect(res.isValid).toBe(true);
    expect(res.family).toBe('IPv6');
    expect(res.normalizedIp).toBe('2001:4860:4860::8888');
  });

  it('should reject invalid IPs, hostnames, URLs, and CIDR ranges', () => {
    expect(validateIpAddress('999.999.999.999').isValid).toBe(false);
    expect(validateIpAddress('google.com').isValid).toBe(false);
    expect(validateIpAddress('https://8.8.8.8').isValid).toBe(false);
    expect(validateIpAddress('8.8.8.0/24').isValid).toBe(false);
    expect(validateIpAddress('').isValid).toBe(false);
    expect(validateIpAddress(null).isValid).toBe(false);
  });

  it('should strictly reject shell injection characters', () => {
    expect(validateIpAddress('8.8.8.8; rm -rf /').isValid).toBe(false);
    expect(validateIpAddress('8.8.8.8 | cat /etc/passwd').isValid).toBe(false);
    expect(validateIpAddress('8.8.8.8 && echo test').isValid).toBe(false);
    expect(validateIpAddress('8.8.8.8`whoami`').isValid).toBe(false);
  });

  it('should protect local loopback and wildcard addresses from being blocked', () => {
    expect(validateIpAddress('127.0.0.1').isProtected).toBe(true);
    expect(validateIpAddress('127.0.0.2').isProtected).toBe(true);
    expect(validateIpAddress('::1').isProtected).toBe(true);
    expect(validateIpAddress('0.0.0.0').isProtected).toBe(true);
    expect(validateIpAddress('::').isProtected).toBe(true);
    expect(validateIpAddress('*').isValid).toBe(false);
  });

  it('should identify private RFC 1918 addresses for user confirmation warnings', () => {
    expect(validateIpAddress('192.168.1.50').isPrivate).toBe(true);
    expect(validateIpAddress('10.0.0.5').isPrivate).toBe(true);
    expect(validateIpAddress('172.20.0.1').isPrivate).toBe(true);
    expect(validateIpAddress('8.8.8.8').isPrivate).toBe(false);
  });
});

describe('PF Rule Generator', () => {
  it('should generate valid macOS PF anchor rules for single and multiple IPs', () => {
    const mockList: BlockedIp[] = [
      { id: '1', ip: '142.250.72.14', family: 'IPv4', blockedAt: 'now', source: 'manual', active: true },
      { id: '2', ip: '2001:4860:4860::8888', family: 'IPv6', blockedAt: 'now', source: 'manual', active: true },
    ];

    const rules = generateApplicationRules(mockList);

    expect(rules).toContain(`Anchor: ${PF_APPLICATION_ANCHOR}`);
    expect(rules).toContain('block drop quick from 142.250.72.14 to any');
    expect(rules).toContain('block drop quick from any to 142.250.72.14');
    expect(rules).toContain('block drop quick from 2001:4860:4860::8888 to any');
    expect(rules).toContain('block drop quick from any to 2001:4860:4860::8888');
  });

  it('should handle empty ruleset gracefully without crashing', () => {
    const rules = generateApplicationRules([]);
    expect(rules).toContain('No active blocked IP rules');
  });
});

describe('PfFirewallService (State & Rollback Tests)', () => {
  let tempDir: string;
  let mockRunner: IPfCommandRunner;
  let shouldFailLoad = false;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-test-fw-'));
    shouldFailLoad = false;

    mockRunner = {
      loadAnchorRules: async () => {
        if (shouldFailLoad) {
          return { stdout: '', stderr: 'Permission denied / syntax error in PF', exitCode: 1 };
        }
        return { stdout: 'Rules loaded', stderr: '', exitCode: 0 };
      },
      clearAnchorRules: async () => ({ stdout: 'Rules cleared', stderr: '', exitCode: 0 }),
      getAnchorRules: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
      checkPfStatus: async () => ({ stdout: 'Status: Enabled', stderr: '', exitCode: 0 }),
      isDryRun: () => true,
    };
  });

  it('should block an IP address and save persistent state', async () => {
    const service = new PfFirewallService({ dataDir: tempDir, commandRunner: mockRunner });

    const res = await service.blockIp('142.250.72.14', 'Blocked test server');
    expect(res.success).toBe(true);
    expect(res.blockedIp).toBeDefined();
    expect(res.blockedIp?.ip).toBe('142.250.72.14');
    expect(service.isIpBlocked('142.250.72.14')).toBe(true);
    expect(service.getBlockedIps()).toHaveLength(1);
  });

  it('should prevent duplicate IP blocking', async () => {
    const service = new PfFirewallService({ dataDir: tempDir, commandRunner: mockRunner });

    await service.blockIp('142.250.72.14');
    const duplicateRes = await service.blockIp('142.250.72.14');

    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.errorCode).toBe('IP_ALREADY_BLOCKED');
    expect(service.getBlockedIps()).toHaveLength(1);
  });

  it('should reject blocking protected local addresses', async () => {
    const service = new PfFirewallService({ dataDir: tempDir, commandRunner: mockRunner });

    const res = await service.blockIp('127.0.0.1');
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('PROTECTED_IP');
  });

  it('should rollback state if pfctl fails to load rules', async () => {
    const service = new PfFirewallService({ dataDir: tempDir, commandRunner: mockRunner });

    // Initial successful block
    await service.blockIp('1.1.1.1');
    expect(service.getBlockedIps()).toHaveLength(1);

    // Simulate PF failure on second block
    shouldFailLoad = true;
    const failedRes = await service.blockIp('2.2.2.2');

    expect(failedRes.success).toBe(false);
    expect(failedRes.errorCode).toBe('PF_LOAD_FAILED');
    // State rollback guarantee: 2.2.2.2 must NOT remain in state
    expect(service.isIpBlocked('2.2.2.2')).toBe(false);
    expect(service.getBlockedIps()).toHaveLength(1);
    expect(service.getBlockedIps()[0]!.ip).toBe('1.1.1.1');
  });

  it('should unblock an IP and clear anchor if list becomes empty', async () => {
    const service = new PfFirewallService({ dataDir: tempDir, commandRunner: mockRunner });

    await service.blockIp('1.1.1.1');
    expect(service.isIpBlocked('1.1.1.1')).toBe(true);

    const unblockRes = await service.unblockIp('1.1.1.1');
    expect(unblockRes.success).toBe(true);
    expect(service.isIpBlocked('1.1.1.1')).toBe(false);
    expect(service.getBlockedIps()).toHaveLength(0);
  });

  it('should return error when unblocking an unblocked IP', async () => {
    const service = new PfFirewallService({ dataDir: tempDir, commandRunner: mockRunner });

    const res = await service.unblockIp('8.8.8.8');
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('BLOCK_NOT_FOUND');
  });

  it('should record audit events for block and unblock actions', async () => {
    const service = new PfFirewallService({ dataDir: tempDir, commandRunner: mockRunner });

    await service.blockIp('8.8.8.8');
    await service.unblockIp('8.8.8.8');

    const events = service.getAuditEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]!.action).toBe('unblock_ip');
    expect(events[1]!.action).toBe('block_ip');
  });
});
