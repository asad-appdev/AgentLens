import { useState, useEffect, useCallback } from 'react';
import { BlockedIp, FirewallStatus, BlockedIpsResponse } from '@network-monitor/shared';

export interface UseFirewallReturn {
  blockedIps: BlockedIp[];
  status: FirewallStatus | null;
  isLoading: boolean;
  error: string | null;
  blockIp: (ip: string, comment?: string) => Promise<{ success: boolean; error?: string }>;
  unblockIp: (ip: string) => Promise<{ success: boolean; error?: string }>;
  isBlocked: (ip: string) => boolean;
  refreshBlockedIps: () => Promise<void>;
}

export function useFirewall(): UseFirewallReturn {
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [status, setStatus] = useState<FirewallStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlockedIps = useCallback(async () => {
    try {
      const res = await fetch('/api/firewall/blocked-ips');
      if (res.ok) {
        const data: BlockedIpsResponse = await res.json();
        setBlockedIps(data.blockedIps);
      }

      const statusRes = await fetch('/api/firewall/status');
      if (statusRes.ok) {
        const statusData: FirewallStatus = await statusRes.json();
        setStatus(statusData);
      }
    } catch (err) {
      console.warn('Failed to fetch firewall status or blocked IPs:', err);
    }
  }, []);

  useEffect(() => {
    fetchBlockedIps();
  }, [fetchBlockedIps]);

  const blockIp = async (ip: string, comment?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/firewall/block-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, comment }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg = data.error?.message || 'Failed to block IP';
        setError(msg);
        return { success: false, error: msg };
      }

      await fetchBlockedIps();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const unblockIp = async (ip: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/firewall/unblock-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg = data.error?.message || 'Failed to unblock IP';
        setError(msg);
        return { success: false, error: msg };
      }

      await fetchBlockedIps();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const isBlocked = (ip: string): boolean => {
    const norm = ip.trim().toLowerCase();
    return blockedIps.some((b) => b.ip.toLowerCase() === norm && b.active);
  };

  return {
    blockedIps,
    status,
    isLoading,
    error,
    blockIp,
    unblockIp,
    isBlocked,
    refreshBlockedIps: fetchBlockedIps,
  };
}
