export type IpFamily = 'IPv4' | 'IPv6';

export interface BlockedIp {
  id: string;
  ip: string;
  family: IpFamily;
  blockedAt: string;
  source: 'manual';
  active: boolean;
  comment?: string;
}

export type FirewallAction = 'block_ip' | 'unblock_ip';

export interface FirewallAuditEvent {
  id: string;
  timestamp: string;
  action: FirewallAction;
  ip: string;
  success: boolean;
  errorCode?: string;
  details?: Record<string, unknown>;
}

export type FirewallErrorCode =
  | 'INVALID_IP'
  | 'IP_ALREADY_BLOCKED'
  | 'BLOCK_NOT_FOUND'
  | 'PROTECTED_IP'
  | 'PERMISSION_DENIED'
  | 'PF_UNAVAILABLE'
  | 'PF_LOAD_FAILED'
  | 'STATE_UPDATE_FAILED'
  | 'VERIFICATION_FAILED';

export interface FirewallStatus {
  isAvailable: boolean;
  isAnchorLoaded: boolean;
  anchorName: string;
  totalBlocked: number;
  lastError: string | null;
  dryRunMode: boolean;
}

export interface BlockIpRequest {
  ip: string;
  comment?: string;
}

export interface UnblockIpRequest {
  ip: string;
}

export interface BlockedIpsResponse {
  timestamp: string;
  total: number;
  blockedIps: BlockedIp[];
}
