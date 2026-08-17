import { describe, it, expect } from 'vitest';
import { config } from '../src/config/env.js';
import {
  isValidPid,
  isValidIp,
  isLoopbackIp,
  isValidSignal,
  isValidPort,
} from '../src/utils/validator.js';

describe('Configuration & Security Checks', () => {
  it('should enforce 127.0.0.1 or local loopback host', () => {
    expect(config.host).toBe('127.0.0.1');
    expect(config.host).not.toBe('0.0.0.0');
    expect(config.host).not.toBe('::');
  });

  it('should have valid default port and interval settings', () => {
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThanOrEqual(65535);
    expect(config.wsHeartbeatIntervalMs).toBeGreaterThan(0);
  });
});

describe('Input Validators', () => {
  it('should correctly validate process IDs (PIDs)', () => {
    expect(isValidPid(1)).toBe(true);
    expect(isValidPid(1234)).toBe(true);
    expect(isValidPid(65535)).toBe(true);
    expect(isValidPid(-1)).toBe(false);
    expect(isValidPid(0)).toBe(false);
    expect(isValidPid(1.5)).toBe(false);
    expect(isValidPid('1234')).toBe(false);
    expect(isValidPid(null)).toBe(false);
    expect(isValidPid(undefined)).toBe(false);
  });

  it('should correctly validate IP addresses', () => {
    expect(isValidIp('127.0.0.1')).toBe(true);
    expect(isValidIp('192.168.1.1')).toBe(true);
    expect(isValidIp('8.8.8.8')).toBe(true);
    expect(isValidIp('::1')).toBe(true);
    expect(isValidIp('2001:db8::1')).toBe(true);
    expect(isValidIp('not-an-ip')).toBe(false);
    expect(isValidIp('999.999.999.999')).toBe(false);
    expect(isValidIp('127.0.0.1; rm -rf /')).toBe(false);
  });

  it('should identify loopback IPs', () => {
    expect(isLoopbackIp('127.0.0.1')).toBe(true);
    expect(isLoopbackIp('127.0.0.2')).toBe(true);
    expect(isLoopbackIp('::1')).toBe(true);
    expect(isLoopbackIp('192.168.1.1')).toBe(false);
    expect(isLoopbackIp('1.1.1.1')).toBe(false);
  });

  it('should validate allowed signals', () => {
    expect(isValidSignal('SIGTERM')).toBe(true);
    expect(isValidSignal('SIGKILL')).toBe(true);
    expect(isValidSignal('SIGINT')).toBe(false);
    expect(isValidSignal('9')).toBe(false);
  });

  it('should validate ports', () => {
    expect(isValidPort(80)).toBe(true);
    expect(isValidPort(443)).toBe(true);
    expect(isValidPort(3000)).toBe(true);
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(70000)).toBe(false);
    expect(isValidPort('80')).toBe(false);
  });
});
