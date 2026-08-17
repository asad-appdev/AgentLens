import { NetworkConnection, NetworkConnectionState, NetworkProtocol } from '@network-monitor/shared';
import { safeParsePowerShellJson } from './powershell-json.parser.js';

export interface PowerShellTcpConnectionRecord {
  LocalAddress?: string;
  LocalPort?: number | string;
  RemoteAddress?: string;
  RemotePort?: number | string;
  State?: string | number;
  OwningProcess?: number | string;
  CreationTime?: string;
}

export interface PowerShellUdpEndpointRecord {
  LocalAddress?: string;
  LocalPort?: number | string;
  OwningProcess?: number | string;
}

/**
 * Maps Windows TCP numeric or text state to normalized state string.
 */
export function normalizeWindowsTcpState(state: string | number | undefined): NetworkConnectionState {
  if (state === undefined || state === null) return 'UNKNOWN';

  if (typeof state === 'number') {
    switch (state) {
      case 2:
        return 'LISTEN';
      case 3:
        return 'SYN_SENT';
      case 4:
        return 'SYN_RECEIVED';
      case 5:
        return 'ESTABLISHED';
      case 6:
        return 'FIN_WAIT_1';
      case 7:
        return 'FIN_WAIT_2';
      case 8:
        return 'CLOSE_WAIT';
      case 9:
        return 'CLOSING';
      case 10:
        return 'LAST_ACK';
      case 11:
        return 'TIME_WAIT';
      default:
        return 'UNKNOWN';
    }
  }

  const s = String(state).trim().toUpperCase();
  switch (s) {
    case 'LISTEN':
    case 'LISTENING':
      return 'LISTEN';
    case 'ESTABLISHED':
      return 'ESTABLISHED';
    case 'CLOSE_WAIT':
    case 'CLOSEWAIT':
      return 'CLOSE_WAIT';
    case 'TIME_WAIT':
    case 'TIMEWAIT':
      return 'TIME_WAIT';
    case 'SYN_SENT':
    case 'SYNSENT':
      return 'SYN_SENT';
    case 'SYN_RECEIVED':
    case 'SYNRECEIVED':
      return 'SYN_RECEIVED';
    case 'FIN_WAIT_1':
    case 'FINWAIT1':
      return 'FIN_WAIT_1';
    case 'FIN_WAIT_2':
    case 'FINWAIT2':
      return 'FIN_WAIT_2';
    case 'CLOSING':
      return 'CLOSING';
    case 'LAST_ACK':
    case 'LASTACK':
      return 'LAST_ACK';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Parses PowerShell `Get-NetTCPConnection` JSON output.
 */
export function parseWindowsTcpJson(
  stdout: string,
  processNameMap: Map<number, string> = new Map(),
  discoveredAt: string = new Date().toISOString()
): NetworkConnection[] {
  const records = safeParsePowerShellJson<PowerShellTcpConnectionRecord>(stdout);
  const connections: NetworkConnection[] = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec) continue;

    const pid = parseInt(String(rec.OwningProcess || '0'), 10);
    const localPort = parseInt(String(rec.LocalPort || '0'), 10);
    const remotePort = rec.RemotePort ? parseInt(String(rec.RemotePort), 10) : null;
    const localAddress = rec.LocalAddress || '0.0.0.0';
    const remoteAddress = rec.RemoteAddress && rec.RemoteAddress !== '0.0.0.0' && rec.RemoteAddress !== '::' ? rec.RemoteAddress : null;
    const state = normalizeWindowsTcpState(rec.State);
    const isListening = state === 'LISTEN';
    const ipVersion = localAddress.includes(':') ? 'IPv6' : 'IPv4';
    const processName = processNameMap.get(pid) || (pid > 0 ? `PID ${pid}` : 'System');

    const id = `win-tcp-${pid}-${localAddress}-${localPort}-${remoteAddress || 'null'}-${remotePort || 'null'}-${i}`;

    connections.push({
      id,
      protocol: 'TCP',
      localAddress,
      localPort: isNaN(localPort) ? null : localPort,
      remoteAddress,
      remotePort: remotePort && !isNaN(remotePort) && remotePort > 0 ? remotePort : null,
      state,
      processName,
      pid,
      ipVersion,
      isListening,
      discoveredAt,
      platform: 'win32',
    });
  }

  return connections;
}

/**
 * Parses PowerShell `Get-NetUDPEndpoint` JSON output.
 */
export function parseWindowsUdpJson(
  stdout: string,
  processNameMap: Map<number, string> = new Map(),
  discoveredAt: string = new Date().toISOString()
): NetworkConnection[] {
  const records = safeParsePowerShellJson<PowerShellUdpEndpointRecord>(stdout);
  const connections: NetworkConnection[] = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec) continue;

    const pid = parseInt(String(rec.OwningProcess || '0'), 10);
    const localPort = parseInt(String(rec.LocalPort || '0'), 10);
    const localAddress = rec.LocalAddress || '0.0.0.0';
    const ipVersion = localAddress.includes(':') ? 'IPv6' : 'IPv4';
    const processName = processNameMap.get(pid) || (pid > 0 ? `PID ${pid}` : 'System');

    const id = `win-udp-${pid}-${localAddress}-${localPort}-${i}`;

    connections.push({
      id,
      protocol: 'UDP',
      localAddress,
      localPort: isNaN(localPort) ? null : localPort,
      remoteAddress: null,
      remotePort: null,
      state: 'UNCONNECTED',
      processName,
      pid,
      ipVersion,
      isListening: false,
      discoveredAt,
      platform: 'win32',
    });
  }

  return connections;
}

/**
 * Fallback parser for standard Windows `netstat -ano` output.
 */
export function parseWindowsNetstatOutput(
  stdout: string,
  processNameMap: Map<number, string> = new Map(),
  discoveredAt: string = new Date().toISOString()
): NetworkConnection[] {
  if (!stdout) return [];
  const lines = stdout.split('\n');
  const connections: NetworkConnection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    // Matches e.g. "TCP    127.0.0.1:5174   142.250.72.14:443   ESTABLISHED   48231"
    // or "UDP    0.0.0.0:5353   *:*   48231"
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;

    const proto = parts[0]?.toUpperCase();
    if (proto !== 'TCP' && proto !== 'UDP') continue;

    const localEndpoint = parts[1] || '';
    const remoteEndpoint = parts[2] || '';
    let stateStr = 'UNKNOWN';
    let pidStr = '0';

    if (proto === 'TCP') {
      stateStr = parts[3] || 'UNKNOWN';
      pidStr = parts[4] || '0';
    } else {
      pidStr = parts[3] || '0';
    }

    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) continue;

    // Parse local host/port
    const lastColonLoc = localEndpoint.lastIndexOf(':');
    if (lastColonLoc === -1) continue;
    const localAddress = localEndpoint.substring(0, lastColonLoc).replace(/^\[|\]$/g, '');
    const localPort = parseInt(localEndpoint.substring(lastColonLoc + 1), 10);

    // Parse remote host/port
    let remoteAddress: string | null = null;
    let remotePort: number | null = null;
    if (remoteEndpoint && remoteEndpoint !== '*:*' && remoteEndpoint !== '0.0.0.0:0') {
      const lastColonRem = remoteEndpoint.lastIndexOf(':');
      if (lastColonRem !== -1) {
        remoteAddress = remoteEndpoint.substring(0, lastColonRem).replace(/^\[|\]$/g, '');
        remotePort = parseInt(remoteEndpoint.substring(lastColonRem + 1), 10);
        if (isNaN(remotePort) || remotePort <= 0) remotePort = null;
      }
    }

    const state = proto === 'TCP' ? normalizeWindowsTcpState(stateStr) : 'UNCONNECTED';
    const isListening = state === 'LISTEN';
    const ipVersion = localAddress.includes(':') ? 'IPv6' : 'IPv4';
    const processName = processNameMap.get(pid) || (pid > 0 ? `PID ${pid}` : 'System');

    const id = `win-netstat-${proto.toLowerCase()}-${pid}-${localAddress}-${localPort}-${i}`;

    connections.push({
      id,
      protocol: proto as NetworkProtocol,
      localAddress,
      localPort: isNaN(localPort) ? null : localPort,
      remoteAddress,
      remotePort,
      state,
      processName,
      pid,
      ipVersion,
      isListening,
      discoveredAt,
      platform: 'win32',
    });
  }

  return connections;
}
