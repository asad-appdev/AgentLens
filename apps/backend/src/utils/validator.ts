import net from 'node:net';

/**
 * Validates a process ID (PID).
 * PIDs must be positive integers within valid operating system bounds.
 */
export function isValidPid(pid: unknown): pid is number {
  if (typeof pid !== 'number') {
    return false;
  }
  return Number.isInteger(pid) && pid > 0 && pid <= 99999;
}

/**
 * Validates an IP address (IPv4 or IPv6).
 */
export function isValidIp(ip: unknown): ip is string {
  if (typeof ip !== 'string' || ip.trim().length === 0) {
    return false;
  }
  return net.isIP(ip.trim()) !== 0;
}

/**
 * Validates whether an IP address is a loopback address.
 */
export function isLoopbackIp(ip: string): boolean {
  if (!isValidIp(ip)) return false;
  const trimmed = ip.trim();
  return trimmed === '127.0.0.1' || trimmed === '::1' || trimmed.startsWith('127.');
}

/**
 * Sanitizes and validates a process signal.
 */
export function isValidSignal(signal: unknown): signal is 'SIGTERM' | 'SIGKILL' {
  return signal === 'SIGTERM' || signal === 'SIGKILL';
}

/**
 * Ensures a port number is valid.
 */
export function isValidPort(port: unknown): port is number {
  if (typeof port !== 'number') return false;
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
