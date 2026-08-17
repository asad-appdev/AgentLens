import net from 'node:net';
import { IpFamily } from '@network-monitor/shared';

export interface IpValidationResult {
  isValid: boolean;
  normalizedIp?: string;
  family?: IpFamily;
  isProtected?: boolean;
  isPrivate?: boolean;
  protectionReason?: string;
  error?: string;
}

/**
 * Validates an IP address with strict security checks.
 * Rejects CIDR notation, hostnames, URLs, shell characters, and whitespace anomalies.
 */
export function validateIpAddress(rawIp: unknown): IpValidationResult {
  if (typeof rawIp !== 'string') {
    return { isValid: false, error: 'IP address must be a string' };
  }

  const trimmed = rawIp.trim();

  if (!trimmed) {
    return { isValid: false, error: 'IP address cannot be empty' };
  }

  // Reject shell characters, whitespace injection, semicolons, quotes, etc.
  if (/[\s;`$|&><\\]/.test(trimmed)) {
    return { isValid: false, error: 'IP address contains invalid characters or injection attempts' };
  }

  // Reject CIDR notation (e.g. 8.8.8.0/24) in Phase 7
  if (trimmed.includes('/')) {
    return { isValid: false, error: 'CIDR ranges are not supported in Phase 7; specify an individual IP address' };
  }

  // Reject URLs or schemes
  if (trimmed.includes('://') || trimmed.startsWith('http')) {
    return { isValid: false, error: 'URLs are not valid IP addresses' };
  }

  // Reject wildcards
  if (trimmed === '*' || trimmed === '*:*') {
    return { isValid: false, error: 'Wildcard addresses cannot be blocked' };
  }

  // Check IPv4 vs IPv6 using native node:net
  const ipType = net.isIP(trimmed);

  if (ipType === 0) {
    return { isValid: false, error: `"${trimmed}" is not a valid IPv4 or IPv6 address (hostnames are not accepted)` };
  }

  const family: IpFamily = ipType === 6 ? 'IPv6' : 'IPv4';
  const normalizedIp = trimmed.toLowerCase();

  // Check Local Machine Protected IPs (Prevent self-blocking)
  const isLoopback =
    normalizedIp === '127.0.0.1' ||
    normalizedIp.startsWith('127.') ||
    normalizedIp === '::1' ||
    normalizedIp === '0.0.0.0' ||
    normalizedIp === '::';

  if (isLoopback) {
    return {
      isValid: true,
      normalizedIp,
      family,
      isProtected: true,
      protectionReason: 'Local loopback and unspecified addresses cannot be blocked to prevent self-isolation',
    };
  }

  // Check Private Network (RFC 1918 / Link-local) for warning dialogs
  const isPrivate = checkIsPrivateIp(normalizedIp, family);

  return {
    isValid: true,
    normalizedIp,
    family,
    isProtected: false,
    isPrivate,
  };
}

/**
 * Checks whether an IP belongs to private RFC 1918 or link-local ranges.
 */
function checkIsPrivateIp(ip: string, family: IpFamily): boolean {
  if (family === 'IPv4') {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4) return false;
    const [p0, p1] = parts;
    if (p0 === 10) return true; // 10.0.0.0/8
    if (p0 === 172 && p1 !== undefined && p1 >= 16 && p1 <= 31) return true; // 172.16.0.0/12
    if (p0 === 192 && p1 === 168) return true; // 192.168.0.0/16
    if (p0 === 169 && p1 === 254) return true; // 169.254.0.0/16 (Link Local)
    return false;
  } else {
    // IPv6 Private / Link-local
    return (
      ip.startsWith('fc00:') ||
      ip.startsWith('fd') ||
      ip.startsWith('fe80:') ||
      ip.startsWith('fe8') ||
      ip.startsWith('fe9') ||
      ip.startsWith('fea') ||
      ip.startsWith('feb')
    );
  }
}
