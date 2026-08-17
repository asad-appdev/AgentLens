import { useState, useEffect, useCallback } from 'react';
import {
  LocalServerInfo,
  KillPortResult,
  KillProcessesResponse,
} from '@network-monitor/shared';

export interface UseLocalServersReturn {
  servers: LocalServerInfo[];
  isLoading: boolean;
  error: string | null;
  fetchServers: () => Promise<void>;
  killPort: (port: number, signal?: 'SIGTERM' | 'SIGKILL') => Promise<KillPortResult | null>;
  killProcesses: (pids?: number[], ports?: number[], signal?: 'SIGTERM' | 'SIGKILL') => Promise<KillProcessesResponse | null>;
}

export function useLocalServers(pollIntervalMs = 3000): UseLocalServersReturn {
  const [servers, setServers] = useState<LocalServerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch('/api/local-servers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.servers)) {
          setServers(data.servers);
        }
        setError(null);
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch servers' }));
        setError(err.error || 'Failed to fetch servers');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchServers();
    if (pollIntervalMs > 0) {
      const interval = setInterval(fetchServers, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchServers, pollIntervalMs]);

  const killPort = async (port: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): Promise<KillPortResult | null> => {
    try {
      const res = await fetch('/api/kill-port', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, signal }),
      });
      const data = await res.json();
      await fetchServers();
      return data;
    } catch {
      return null;
    }
  };

  const killProcesses = async (
    pids?: number[],
    ports?: number[],
    signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'
  ): Promise<KillProcessesResponse | null> => {
    try {
      const res = await fetch('/api/kill-processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pids, ports, signal }),
      });
      const data = await res.json();
      await fetchServers();
      return data;
    } catch {
      return null;
    }
  };

  return {
    servers,
    isLoading,
    error,
    fetchServers,
    killPort,
    killProcesses,
  };
}
