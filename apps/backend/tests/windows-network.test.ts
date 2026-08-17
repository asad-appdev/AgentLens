import { describe, it, expect } from 'vitest';
import {
  parseWindowsTcpJson,
  parseWindowsUdpJson,
  parseWindowsNetstatOutput,
  normalizeWindowsTcpState,
} from '../src/platform/windows/parsers/windows-net-tcp.parser.js';
import { WindowsNetworkProvider } from '../src/platform/windows/windows-network.provider.js';
import { CommandRunnerService } from '../src/services/command-runner.service.js';

describe('Windows Network Parser & Provider Unit Tests', () => {
  it('should normalize TCP numeric and string states correctly', () => {
    expect(normalizeWindowsTcpState(2)).toBe('LISTEN');
    expect(normalizeWindowsTcpState(5)).toBe('ESTABLISHED');
    expect(normalizeWindowsTcpState(8)).toBe('CLOSE_WAIT');
    expect(normalizeWindowsTcpState(11)).toBe('TIME_WAIT');
    expect(normalizeWindowsTcpState('Listen')).toBe('LISTEN');
    expect(normalizeWindowsTcpState('Established')).toBe('ESTABLISHED');
    expect(normalizeWindowsTcpState('CloseWait')).toBe('CLOSE_WAIT');
    expect(normalizeWindowsTcpState('unknown_state')).toBe('UNKNOWN');
  });

  it('should parse Get-NetTCPConnection JSON records into normalized NetworkConnection models', () => {
    const tcpJsonFixture = JSON.stringify([
      {
        LocalAddress: '127.0.0.1',
        LocalPort: 5174,
        RemoteAddress: '142.250.72.14',
        RemotePort: 443,
        State: 5,
        OwningProcess: 48231,
      },
      {
        LocalAddress: '0.0.0.0',
        LocalPort: 3000,
        RemoteAddress: '0.0.0.0',
        RemotePort: 0,
        State: 'Listen',
        OwningProcess: 4211,
      },
      {
        LocalAddress: '::1',
        LocalPort: 11434,
        RemoteAddress: '::',
        RemotePort: 0,
        State: 'Listen',
        OwningProcess: 9999,
      },
    ]);

    const procNameMap = new Map<number, string>([
      [48231, 'node.exe'],
      [4211, 'python.exe'],
      [9999, 'ollama.exe'],
    ]);

    const connections = parseWindowsTcpJson(tcpJsonFixture, procNameMap, '2026-08-16T22:00:00.000Z');

    expect(connections).toHaveLength(3);

    const first = connections[0]!;
    expect(first.protocol).toBe('TCP');
    expect(first.localAddress).toBe('127.0.0.1');
    expect(first.localPort).toBe(5174);
    expect(first.remoteAddress).toBe('142.250.72.14');
    expect(first.remotePort).toBe(443);
    expect(first.state).toBe('ESTABLISHED');
    expect(first.pid).toBe(48231);
    expect(first.processName).toBe('node.exe');
    expect(first.platform).toBe('win32');
    expect(first.isListening).toBe(false);

    const second = connections[1]!;
    expect(second.localPort).toBe(3000);
    expect(second.state).toBe('LISTEN');
    expect(second.isListening).toBe(true);
    expect(second.remoteAddress).toBeNull();
    expect(second.ipVersion).toBe('IPv4');

    const third = connections[2]!;
    expect(third.localAddress).toBe('::1');
    expect(third.ipVersion).toBe('IPv6');
    expect(third.isListening).toBe(true);
    expect(third.processName).toBe('ollama.exe');
  });

  it('should parse Get-NetUDPEndpoint JSON records into NetworkConnection models', () => {
    const udpJsonFixture = JSON.stringify([
      {
        LocalAddress: '0.0.0.0',
        LocalPort: 5353,
        OwningProcess: 48231,
      },
    ]);

    const connections = parseWindowsUdpJson(udpJsonFixture, new Map([[48231, 'node.exe']]));
    expect(connections).toHaveLength(1);
    expect(connections[0]!.protocol).toBe('UDP');
    expect(connections[0]!.localPort).toBe(5353);
    expect(connections[0]!.state).toBe('UNCONNECTED');
    expect(connections[0]!.platform).toBe('win32');
  });

  it('should parse netstat -ano fallback output', () => {
    const netstatOutput = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    127.0.0.1:5174         142.250.72.14:443      ESTABLISHED     48231
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1234
  UDP    0.0.0.0:5353           *:*                                    5678
`;

    const connections = parseWindowsNetstatOutput(netstatOutput);
    expect(connections).toHaveLength(3);
    expect(connections[0]!.protocol).toBe('TCP');
    expect(connections[0]!.localPort).toBe(5174);
    expect(connections[0]!.remoteAddress).toBe('142.250.72.14');
    expect(connections[0]!.state).toBe('ESTABLISHED');
    expect(connections[1]!.state).toBe('LISTEN');
    expect(connections[2]!.protocol).toBe('UDP');
    expect(connections[2]!.localPort).toBe(5353);
  });

  it('should discover connections through mocked runner in WindowsNetworkProvider', async () => {
    const mockRunner = new CommandRunnerService(true);
    const provider = new WindowsNetworkProvider(mockRunner);

    const connections = await provider.getConnections();
    expect(Array.isArray(connections)).toBe(true);
  });
});
