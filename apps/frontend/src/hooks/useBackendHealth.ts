import { useState, useEffect, useCallback } from 'react';
import { HealthResponse } from '@network-monitor/shared';
import { fetchHealth } from '../services/api.js';

export type HealthStatus = 'checking' | 'healthy' | 'unhealthy';

export function useBackendHealth(pollIntervalMs = 10000) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<HealthStatus>('checking');
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetchHealth();
      setData(res);
      setStatus('healthy');
      setError(null);
    } catch (err: unknown) {
      setStatus('unhealthy');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, pollIntervalMs]);

  return { data, status, error, refetch: checkHealth };
}
