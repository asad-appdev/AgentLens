import {
  NetworkConnection,
  NetworkProtocol,
  NetworkConnectionState,
} from '@network-monitor/shared';

export interface ParseEndpointResult {
  address: string;
  port: number | null;
}

export interface ParseResult {
  connections: NetworkConnection[];
  totalParsed: number;
  skippedLines: number;
  errors: Array<{ lineIndex: number; line: string; reason: string }>;
}

export class LsofParser {
  /**
   * Parses raw string output from `lsof -i -P -n` into typed NetworkConnection records.
   */
  public parse(rawOutput: string, discoveredAt: string = new Date().toISOString()): ParseResult {
    const connections: NetworkConnection[] = [];
    const connectionMap = new Map<string, NetworkConnection>();
    const errors: Array<{ lineIndex: number; line: string; reason: string }> = [];
    let skippedLines = 0;

    if (!rawOutput || rawOutput.trim().length === 0) {
      return { connections: [], totalParsed: 0, skippedLines: 0, errors: [] };
    }

    const lines = rawOutput.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) {
        skippedLines++;
        continue;
      }

      // Skip header line (e.g. COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME)
      if (line.startsWith('COMMAND') && line.includes('PID') && line.includes('NAME')) {
        skippedLines++;
        continue;
      }

      try {
        const parsed = this.parseLine(line, discoveredAt);
        if (parsed) {
          // Deduplicate based on deterministic connection ID
          if (!connectionMap.has(parsed.id)) {
            connectionMap.set(parsed.id, parsed);
            connections.push(parsed);
          }
        } else {
          skippedLines++;
        }
      } catch (err: unknown) {
        skippedLines++;
        errors.push({
          lineIndex: i + 1,
          line,
          reason: err instanceof Error ? err.message : 'Unknown parsing error',
        });
      }
    }

    return {
      connections,
      totalParsed: connections.length,
      skippedLines,
      errors,
    };
  }

  /**
   * Parses a single line from lsof output.
   */
  public parseLine(line: string, discoveredAt: string = new Date().toISOString()): NetworkConnection | null {
    // Expected standard fields: COMMAND PID USER FD TYPE DEVICE [SIZE/OFF] NODE NAME
    const tokens = line.trim().split(/\s+/);

    if (tokens.length < 8) {
      throw new Error(`Insufficient column count (${tokens.length} < 8)`);
    }

    // Find the NODE token which indicates protocol: 'TCP' or 'UDP'
    const protocolIndex = tokens.findIndex((t, idx) => idx >= 4 && (t === 'TCP' || t === 'UDP'));
    if (protocolIndex === -1) {
      throw new Error('Could not identify TCP or UDP protocol column');
    }

    const protocol = tokens[protocolIndex] as NetworkProtocol;
    const command = tokens[0]!;
    const rawPid = tokens[1]!;
    const pid = parseInt(rawPid, 10);
    if (isNaN(pid) || pid < 0) {
      throw new Error(`Invalid PID: ${rawPid}`);
    }

    const user = tokens[2];
    const fd = tokens[3];
    const rawType = tokens[4];
    const ipVersion: 'IPv4' | 'IPv6' = rawType?.includes('6') ? 'IPv6' : 'IPv4';

    // The NAME component starts after the protocol token and may include state in parenthesis
    const nameTokens = tokens.slice(protocolIndex + 1);
    const rawNameString = nameTokens.join(' ');

    if (!rawNameString) {
      throw new Error('Missing NAME field for socket specification');
    }

    // Extract state if specified in parentheses e.g. "(LISTEN)", "(ESTABLISHED)", "(CLOSE_WAIT)"
    let state: NetworkConnectionState | string = 'UNCONNECTED';
    let socketEndpointsStr = rawNameString;

    const stateMatch = rawNameString.match(/\s*\(([^)]+)\)$/);
    if (stateMatch && stateMatch[1]) {
      state = this.normalizeState(stateMatch[1].trim());
      socketEndpointsStr = rawNameString.slice(0, stateMatch.index).trim();
    } else if (protocol === 'TCP') {
      state = 'UNKNOWN';
    }

    const isListening = state === 'LISTEN' || (protocol === 'UDP' && socketEndpointsStr.includes('*'));

    // Split local vs remote endpoints (connected sockets use '->')
    let localStr = socketEndpointsStr;
    let remoteStr: string | null = null;

    if (socketEndpointsStr.includes('->')) {
      const parts = socketEndpointsStr.split('->');
      localStr = parts[0]!.trim();
      remoteStr = parts[1]?.trim() || null;
    }

    const localEndpoint = this.parseEndpoint(localStr);
    const remoteEndpoint = remoteStr ? this.parseEndpoint(remoteStr) : null;

    const id = this.generateDeterministicId(
      protocol,
      pid,
      localEndpoint.address,
      localEndpoint.port,
      remoteEndpoint?.address ?? null,
      remoteEndpoint?.port ?? null,
      state
    );

    return {
      id,
      protocol,
      localAddress: localEndpoint.address,
      localPort: localEndpoint.port,
      remoteAddress: remoteEndpoint ? remoteEndpoint.address : null,
      remotePort: remoteEndpoint ? remoteEndpoint.port : null,
      state,
      processName: command,
      pid,
      user,
      fd,
      ipVersion,
      isListening,
      command,
      discoveredAt,
    };
  }

  /**
   * Safely parses IP address (IPv4 / IPv6) and port from an endpoint string.
   */
  public parseEndpoint(endpointStr: string): ParseEndpointResult {
    const str = endpointStr.trim();

    if (!str || str === '*:*' || str === '*') {
      return { address: '*', port: null };
    }

    // Case 1: IPv6 with brackets, e.g. "[::1]:8080" or "[2001:db8::1]:443"
    const bracketMatch = str.match(/^\[([^\]]+)\](?::(\d+|\*))?$/);
    if (bracketMatch) {
      const address = bracketMatch[1]!;
      const portRaw = bracketMatch[2];
      const port = portRaw && portRaw !== '*' ? parseInt(portRaw, 10) : null;
      return { address, port: isNaN(port as number) ? null : port };
    }

    // Case 2: Wildcard or IPv4 host, e.g. "*:80", "127.0.0.1:3000", "0.0.0.0:443"
    const lastColonIdx = str.lastIndexOf(':');
    if (lastColonIdx !== -1) {
      const addressPart = str.slice(0, lastColonIdx).trim();
      const portPart = str.slice(lastColonIdx + 1).trim();

      // Check if address part is IPv6 without brackets (multiple colons in addressPart)
      const portNum = portPart === '*' ? null : parseInt(portPart, 10);
      const isValidPortNumber = portNum !== null && !isNaN(portNum) && portNum >= 0 && portNum <= 65535;

      if (isValidPortNumber || portPart === '*') {
        return {
          address: addressPart || '*',
          port: isValidPortNumber ? portNum : null,
        };
      }
    }

    // Case 3: Just address or wildcard without colon
    return { address: str, port: null };
  }

  /**
   * Normalizes raw socket states to known NetworkConnectionState enum.
   */
  private normalizeState(rawState: string): NetworkConnectionState | string {
    const upper = rawState.toUpperCase();
    const knownStates: Record<string, NetworkConnectionState> = {
      LISTEN: 'LISTEN',
      LISTENING: 'LISTEN',
      ESTABLISHED: 'ESTABLISHED',
      ESTABLISHED_IDLE: 'ESTABLISHED',
      CLOSE_WAIT: 'CLOSE_WAIT',
      TIME_WAIT: 'TIME_WAIT',
      SYN_SENT: 'SYN_SENT',
      SYN_RECEIVED: 'SYN_RECEIVED',
      SYN_RCVD: 'SYN_RECEIVED',
      FIN_WAIT_1: 'FIN_WAIT_1',
      FIN_WAIT_2: 'FIN_WAIT_2',
      CLOSING: 'CLOSING',
      LAST_ACK: 'LAST_ACK',
      CLOSED: 'CLOSED' as any,
      UNCONNECTED: 'UNCONNECTED',
    };

    return knownStates[upper] || upper;
  }

  /**
   * Generates a stable deterministic connection ID.
   */
  public generateDeterministicId(
    protocol: NetworkProtocol,
    pid: number,
    localAddress: string,
    localPort: number | null,
    remoteAddress: string | null,
    remotePort: number | null,
    state: string
  ): string {
    const normLocalAddr = (localAddress || '*').toLowerCase();
    const normLocalPort = localPort ?? '*';
    const normRemoteAddr = (remoteAddress || '*').toLowerCase();
    const normRemotePort = remotePort ?? '*';
    const normState = (state || 'none').toLowerCase().replace(/[^a-z0-9_]/g, '');

    return `${protocol.toLowerCase()}-${pid}-${normLocalAddr}-${normLocalPort}-${normRemoteAddr}-${normRemotePort}-${normState}`;
  }
}

export const lsofParser = new LsofParser();
