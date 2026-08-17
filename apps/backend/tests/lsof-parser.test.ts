import { describe, it, expect } from 'vitest';
import { LsofParser } from '../src/services/lsof-parser.service.js';

describe('LsofParser (Phase 3 Unit Tests)', () => {
  const parser = new LsofParser();

  it('Test 1: should parse TCP LISTEN socket', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node       1234 user   20u  IPv4 0x73b4e72390f77241      0t0  TCP 127.0.0.1:3000 (LISTEN)
    `;

    const result = parser.parse(raw);
    expect(result.connections).toHaveLength(1);

    const conn = result.connections[0]!;
    expect(conn.protocol).toBe('TCP');
    expect(conn.localAddress).toBe('127.0.0.1');
    expect(conn.localPort).toBe(3000);
    expect(conn.remoteAddress).toBeNull();
    expect(conn.remotePort).toBeNull();
    expect(conn.state).toBe('LISTEN');
    expect(conn.isListening).toBe(true);
    expect(conn.pid).toBe(1234);
    expect(conn.processName).toBe('node');
    expect(conn.ipVersion).toBe('IPv4');
  });

  it('Test 2: should parse TCP ESTABLISHED connection with local and remote endpoints', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node       1234 user   21u  IPv4 0x73b4e72390f77242      0t0  TCP 192.168.1.10:52341->142.250.72.14:443 (ESTABLISHED)
    `;

    const result = parser.parse(raw);
    expect(result.connections).toHaveLength(1);

    const conn = result.connections[0]!;
    expect(conn.protocol).toBe('TCP');
    expect(conn.localAddress).toBe('192.168.1.10');
    expect(conn.localPort).toBe(52341);
    expect(conn.remoteAddress).toBe('142.250.72.14');
    expect(conn.remotePort).toBe(443);
    expect(conn.state).toBe('ESTABLISHED');
    expect(conn.isListening).toBe(false);
    expect(conn.pid).toBe(1234);
    expect(conn.processName).toBe('node');
  });

  it('Test 3: should parse IPv6 addresses with brackets and multi-colon format', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
ollama      4218 user   10u  IPv6 0x73b4e72390f77243      0t0  TCP [::1]:11434 (LISTEN)
curl        5500 user   11u  IPv6 0x73b4e72390f77244      0t0  TCP [2607:f8b0:4005:805::200e]:54321->[2607:f8b0:4005:805::200e]:443 (ESTABLISHED)
    `;

    const result = parser.parse(raw);
    expect(result.connections).toHaveLength(2);

    const listenConn = result.connections[0]!;
    expect(listenConn.localAddress).toBe('::1');
    expect(listenConn.localPort).toBe(11434);
    expect(listenConn.ipVersion).toBe('IPv6');
    expect(listenConn.state).toBe('LISTEN');

    const estConn = result.connections[1]!;
    expect(estConn.localAddress).toBe('2607:f8b0:4005:805::200e');
    expect(estConn.localPort).toBe(54321);
    expect(estConn.remoteAddress).toBe('2607:f8b0:4005:805::200e');
    expect(estConn.remotePort).toBe(443);
    expect(estConn.state).toBe('ESTABLISHED');
    expect(estConn.ipVersion).toBe('IPv6');
  });

  it('Test 4: should parse UDP sockets safely without forcing TCP states', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node       1234 user   22u  IPv4 0x73b4e72390f77245      0t0  UDP 192.168.1.20:5353
mDNSResp    300 root   23u  IPv4 0x73b4e72390f77246      0t0  UDP *:5353
    `;

    const result = parser.parse(raw);
    expect(result.connections).toHaveLength(2);

    const udp1 = result.connections[0]!;
    expect(udp1.protocol).toBe('UDP');
    expect(udp1.localAddress).toBe('192.168.1.20');
    expect(udp1.localPort).toBe(5353);
    expect(udp1.remoteAddress).toBeNull();
    expect(udp1.remotePort).toBeNull();
    expect(udp1.state).toBe('UNCONNECTED');
    expect(udp1.isListening).toBe(false);

    const udp2 = result.connections[1]!;
    expect(udp2.localAddress).toBe('*');
    expect(udp2.localPort).toBe(5353);
    expect(udp2.isListening).toBe(true);
  });

  it('Test 5: should handle wildcard addresses and ports (*:80, *:*)', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
launchd       1 root   29u  IPv6 0x73b4e72390f77247      0t0  TCP *:22 (LISTEN)
sysmond     180 root   30u  IPv4 0x73b4e72390f77248      0t0  UDP *:*
    `;

    const result = parser.parse(raw);
    expect(result.connections).toHaveLength(2);

    expect(result.connections[0]!.localAddress).toBe('*');
    expect(result.connections[0]!.localPort).toBe(22);
    expect(result.connections[0]!.state).toBe('LISTEN');

    expect(result.connections[1]!.localAddress).toBe('*');
    expect(result.connections[1]!.localPort).toBeNull();
  });

  it('Test 6: should support multiple distinct connections from the same PID', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node       1234 user   20u  IPv4 0x73b4e72390f77241      0t0  TCP 127.0.0.1:3000 (LISTEN)
node       1234 user   21u  IPv4 0x73b4e72390f77242      0t0  TCP 127.0.0.1:3001 (LISTEN)
node       1234 user   22u  IPv4 0x73b4e72390f77243      0t0  TCP 192.168.1.10:52341->142.250.72.14:443 (ESTABLISHED)
    `;

    const result = parser.parse(raw);
    expect(result.connections).toHaveLength(3);
    expect(result.connections.every((c) => c.pid === 1234)).toBe(true);
    expect(new Set(result.connections.map((c) => c.id)).size).toBe(3);
  });

  it('Test 7: should skip malformed lines without crashing the entire dataset', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
CORRUPTED_LINE_TOO_SHORT
node       1234 user   20u  IPv4 0x73b4e72390f77241      0t0  TCP 127.0.0.1:3000 (LISTEN)
INVALID_PID NOT_A_NUMBER user 20u IPv4 0x0 0t0 TCP 127.0.0.1:8080 (LISTEN)
node       1234 user   21u  IPv4 0x73b4e72390f77242      0t0  TCP 192.168.1.10:52341->142.250.72.14:443 (ESTABLISHED)
    `;

    const result = parser.parse(raw);
    expect(result.connections).toHaveLength(2);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('Test 8: should deduplicate duplicate socket records with identical tuples', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node       1234 user   20u  IPv4 0x73b4e72390f77241      0t0  TCP 127.0.0.1:3000 (LISTEN)
node       1234 user   21u  IPv4 0x73b4e72390f77241      0t0  TCP 127.0.0.1:3000 (LISTEN)
    `;

    const result = parser.parse(raw);
    expect(result.connections).toHaveLength(1);
  });

  it('Test 9: should generate stable, deterministic connection IDs', () => {
    const raw = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node       1234 user   20u  IPv4 0x73b4e72390f77241      0t0  TCP 127.0.0.1:3000 (LISTEN)
    `;

    const result1 = parser.parse(raw, '2026-08-15T00:00:00.000Z');
    const result2 = parser.parse(raw, '2026-08-15T00:05:00.000Z');

    expect(result1.connections[0]!.id).toBe(result2.connections[0]!.id);
    expect(result1.connections[0]!.id).toBe('tcp-1234-127.0.0.1-3000-*-*-listen');
  });
});
